"""Who may change which data set."""

from accounts.permissions import has_permission, is_manager


def can_edit_page(user, *page_keys):
    """True for managers, or for a user who has Edit on one of these pages."""
    if is_manager(user):
        return True
    return any(has_permission(user, key, "edit") for key in page_keys)


__all__ = ["can_edit_page", "is_manager"]
