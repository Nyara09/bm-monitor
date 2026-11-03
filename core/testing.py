"""Helpers for the tests of the Django screens."""

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Role


class ScreenTestCase(TestCase):
    """Creates an admin, a reader and a supervisor and signs people in."""

    @classmethod
    def setUpTestData(cls):
        cls.admin = cls.make_user("admin_user", Role.ADMIN)
        cls.reader = cls.make_user("reader_user", Role.READER)
        cls.supervisor = cls.make_user("supervisor_user", Role.SUPERVISOR)

    @staticmethod
    def make_user(username, role):
        user = User.objects.create_user(username, password="pass-12345-word")
        user.profile.role = role
        user.profile.save()
        return user

    def sign_in(self, user):
        self.client.force_login(user)
