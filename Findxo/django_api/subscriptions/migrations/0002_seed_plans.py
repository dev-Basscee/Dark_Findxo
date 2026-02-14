from django.db import migrations


def seed_plans(apps, schema_editor):
	Plan = apps.get_model('subscriptions', 'Plan')
	defaults = [
		{"name": "Basic", "price": 9.99, "interval": "monthly"},
		{"name": "Pro", "price": 19.99, "interval": "monthly"},
		{"name": "Pro Annual", "price": 199.00, "interval": "yearly"},
	]
	for d in defaults:
		Plan.objects.get_or_create(name=d["name"], defaults={"price": d["price"], "interval": d["interval"]})


def unseed_plans(apps, schema_editor):
	Plan = apps.get_model('subscriptions', 'Plan')
	Plan.objects.filter(name__in=["Basic", "Pro", "Pro Annual"]).delete()


class Migration(migrations.Migration):
	dependencies = [
		("subscriptions", "0001_initial"),
	]

	operations = [
		migrations.RunPython(seed_plans, reverse_code=unseed_plans),
	]

