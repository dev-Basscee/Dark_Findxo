import secrets
import hashlib
import requests
import json
from datetime import timedelta
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import SubscriptionPlan, UserSubscription, APIKey
from .serializers import PlanSerializer, SubscriptionSerializer, SubscribeInputSerializer, APIKeySerializer
from django.conf import settings
from django.urls import reverse
from django.contrib.auth.models import User
from accounts.models import UserProfile

# Solana imports
from solana.rpc.api import Client
from solders.signature import Signature
from solders.pubkey import Pubkey

class PlansListView(generics.ListAPIView):
    queryset = SubscriptionPlan.objects.all().order_by('monthly_price_eur')
    serializer_class = PlanSerializer
    permission_classes = [permissions.AllowAny]

class SubscribeView(generics.GenericAPIView):
    serializer_class = SubscribeInputSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        plan_id = serializer.validated_data['plan_id']
        billing_period = serializer.validated_data['billing_period']
        wallet_address = request.data.get('wallet_address')

        user_id = None
        user_email = "no-email@findxo.com"
        if request.user.is_authenticated:
            user_id = str(request.user.id)
            user_email = request.user.email
        elif wallet_address:
            profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
            if profile:
                user_id = str(profile.user.id)
                user_email = profile.user.email
            else:
                return Response({'detail': 'User not found for this wallet. Please register first.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'detail': 'Authentication required or wallet_address must be provided.'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        paystack_secret_key = settings.PAYSTACK_SECRET_KEY
        if not paystack_secret_key:
            return Response({'detail': 'Paystack is not configured.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if billing_period == 'monthly':
            price = plan.monthly_price_eur
            plan_code = plan.paystack_monthly_plan_code
        else:
            price = plan.yearly_price_eur
            plan_code = plan.paystack_yearly_plan_code

        if not price:
            return Response({'detail': 'Price for this period is not set.'}, status=status.HTTP_400_BAD_REQUEST)

        amount_kobo = int(price * 100)
        url = "https://api.paystack.co/transaction/initialize"
        headers = {
            "Authorization": f"Bearer {paystack_secret_key}",
            "Content-Type": "application/json"
        }
        
        callback_url = request.build_absolute_uri(reverse('status'))
        
        payload = {
            "email": user_email,
            "amount": amount_kobo,
            "callback_url": callback_url,
            "metadata": {
                "user_id": user_id,
                "plan_id": str(plan.id),
                "billing_period": billing_period
            }
        }

        if plan_code:
            payload["plan"] = plan_code

        try:
            response = requests.post(url, headers=headers, json=payload)
            res_data = response.json()
            if response.status_code == 200 and res_data.get('status'):
                return Response({'checkout_url': res_data['data']['authorization_url']})
            else:
                return Response({'detail': res_data.get('message', 'Failed to initialize transaction')}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SolanaVerifyView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        signature_str = request.data.get('signature')
        expected_amount_sol = request.data.get('expected_amount')
        plan_id = request.data.get('plan_id')
        billing_period = request.data.get('billing_period', 'monthly')
        wallet_address = request.data.get('wallet_address')

        if not all([signature_str, expected_amount_sol, plan_id, wallet_address]):
            return Response({'detail': 'Missing parameters'}, status=status.HTTP_400_BAD_REQUEST)

        profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
        if not profile:
             return Response({'detail': 'User not found for this wallet.'}, status=status.HTTP_404_NOT_FOUND)
        user = profile.user

        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'detail': 'Plan not found'}, status=status.HTTP_404_NOT_FOUND)

        rpc_url = settings.NEXT_PUBLIC_SOLANA_RPC_URL or "https://api.mainnet-beta.solana.com"
        merchant_wallet = settings.NEXT_PUBLIC_MERCHANT_WALLET

        if not merchant_wallet:
            return Response({'detail': 'Merchant wallet not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        client = Client(rpc_url)
        try:
            sig = Signature.from_string(signature_str)
            tx_res = client.get_transaction(sig, max_supported_transaction_version=0)
            
            if tx_res.value is None:
                return Response({'detail': 'Transaction not found or not yet confirmed'}, status=status.HTTP_400_BAD_REQUEST)

            transaction = tx_res.value
            meta = transaction.transaction.meta
            if meta is None or meta.err is not None:
                return Response({'detail': 'Transaction failed on-chain'}, status=status.HTTP_400_BAD_REQUEST)

            account_keys = transaction.transaction.transaction.message.account_keys
            merchant_index = -1
            for i, key in enumerate(account_keys):
                if str(key) == merchant_wallet:
                    merchant_index = i
                    break
            
            if merchant_index == -1:
                return Response({'detail': 'Merchant wallet not found in transaction'}, status=status.HTTP_400_BAD_REQUEST)

            pre_balance = meta.pre_balances[merchant_index]
            post_balance = meta.post_balances[merchant_index]
            received_lamports = post_balance - pre_balance
            received_sol = received_lamports / 10**9

            tolerance = 0.001
            if abs(float(received_sol) - float(expected_amount_sol)) > tolerance:
                return Response({'detail': f'Amount mismatch. Received: {received_sol}, Expected: {expected_amount_sol}'}, status=status.HTTP_400_BAD_REQUEST)

            starts_at = timezone.now()
            expires_at = starts_at + (timedelta(days=30) if billing_period == 'monthly' else timedelta(days=365))

            UserSubscription.objects.filter(user_id=user.id, status='active').update(status='canceled')
            
            sub = UserSubscription.objects.create(
                user_id=user.id,
                plan=plan,
                starts_at=starts_at,
                expires_at=expires_at,
                status='active',
                solana_signature=signature_str
            )

            return Response({
                'success': True, 
                'detail': 'Solana payment verified and subscription activated',
                'subscription': SubscriptionSerializer(sub).data
            })

        except Exception as e:
            return Response({'detail': f'Verification error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CancelSubscriptionView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        wallet_address = request.data.get('wallet_address')
        if not wallet_address:
             return Response({'detail': 'wallet_address required'}, status=status.HTTP_400_BAD_REQUEST)
        
        profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
        if not profile:
             return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user = profile.user

        sub = UserSubscription.objects.filter(user_id=user.id, status='active').first()
        if not sub:
            return Response({'detail': 'No active subscription'}, status=status.HTTP_404_NOT_FOUND)

        if sub.paystack_subscription_id:
            paystack_secret_key = settings.PAYSTACK_SECRET_KEY
            url = "https://api.paystack.co/subscription/disable"
            headers = {"Authorization": f"Bearer {paystack_secret_key}", "Content-Type": "application/json"}
            payload = {"code": sub.paystack_subscription_id}
            try:
                requests.post(url, headers=headers, json=payload)
            except:
                pass

        sub.status = 'canceled'
        sub.save()
        return Response({'detail': 'Subscription marked as canceled.'})

class SubscriptionStatusView(generics.RetrieveAPIView):
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.AllowAny]

    def get_object(self):
        wallet_address = self.request.query_params.get('wallet_address')
        if not wallet_address:
             return None
        
        profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
        if not profile:
             return None
        user = profile.user

        sub = UserSubscription.objects.filter(user_id=user.id).order_by('-created_at').first()
        if sub and sub.status == 'active' and sub.expires_at and sub.expires_at < timezone.now():
            sub.status = 'expired'
            sub.save(update_fields=['status'])
        return sub

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def subscription_status(request):
    wallet_address = request.query_params.get('wallet_address')
    if not wallet_address:
        return Response({'detail': 'wallet_address required'}, status=status.HTTP_400_BAD_REQUEST)
    
    profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
    if not profile:
        return Response({'detail': 'No subscription found (User not found)'}, status=status.HTTP_404_NOT_FOUND)
    
    sub = UserSubscription.objects.filter(user_id=profile.user.id).order_by('-created_at').first()
    if not sub:
        return Response({'detail': 'No subscription found'}, status=status.HTTP_404_NOT_FOUND)
    
    if sub.status == 'active' and sub.expires_at and sub.expires_at < timezone.now():
        sub.status = 'expired'
        sub.save(update_fields=['status'])
        
    serializer = SubscriptionSerializer(sub)
    return Response(serializer.data)

class APIKeyView(generics.ListCreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = APIKeySerializer

    def get_queryset(self):
        wallet_address = self.request.query_params.get('wallet_address')
        if not wallet_address:
            return APIKey.objects.none()
        profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
        if not profile:
            return APIKey.objects.none()
        return APIKey.objects.filter(user_id=profile.user.id, status='active').order_by('-created_at')

    def create(self, request, *args, **kwargs):
        wallet_address = request.data.get('wallet_address')
        if not wallet_address:
             return Response({'detail': 'wallet_address required'}, status=status.HTTP_400_BAD_REQUEST)
        
        profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
        if not profile:
             return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user = profile.user

        has_active_subscription = UserSubscription.objects.filter(
            user_id=user.id, 
            status='active', 
            expires_at__gt=timezone.now()
        ).exists()
        
        if not has_active_subscription:
            return Response({'detail': 'You must have an active subscription to create API keys.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_key = secrets.token_urlsafe(32)
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        api_key = serializer.save(user_id=user.id, key_hash=key_hash)

        data = serializer.data
        data['key'] = raw_key
        return Response(data, status=status.HTTP_201_CREATED)

class RevokeAPIKeyView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        wallet_address = request.data.get('wallet_address')
        if not wallet_address:
             return Response({'detail': 'wallet_address required'}, status=status.HTTP_400_BAD_REQUEST)
        
        profile = UserProfile.objects.filter(wallet_address__iexact=wallet_address).first()
        if not profile:
             return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        
        APIKey.objects.filter(user_id=profile.user.id, id=pk).update(status='revoked')
        return Response({'detail': 'API Key revoked'}, status=status.HTTP_200_OK)
