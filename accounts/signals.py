"""Give every new Django user a profile with the default role and Switch view cards."""

from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Role, UserProfile
from .services import default_cards


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):
    if not created:
        return
    role = Role.ADMIN if instance.is_superuser else Role.SUPERVISOR
    UserProfile.objects.get_or_create(user=instance, defaults={"role": role, **default_cards(role)})
