from django.contrib.auth.models import User
from rest_framework import serializers
from .models import UserProfile

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    wallet_address = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'wallet_address')

    def create(self, validated_data):
        wallet_address = validated_data.pop('wallet_address', None)
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        if wallet_address:
            # Ensure profile exists and set wallet
            UserProfile.objects.update_or_create(user=user, defaults={"wallet_address": wallet_address})
        else:
            # Create empty profile for future updates
            UserProfile.objects.get_or_create(user=user)
        return user

class UserSerializer(serializers.ModelSerializer):
    wallet_address = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_joined', 'wallet_address')

    def get_wallet_address(self, obj):
        try:
            return obj.profile.wallet_address
        except Exception:
            return None
