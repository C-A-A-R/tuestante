from django.contrib.auth import get_user_model
from simple_history.signals import pre_create_historical_record

from .middleware import get_current_request


def _actor_repr(user):
    """Return a compact textual representation for non-Admin actors."""
    if user is None:
        return 'Anonymous'
    # Prefer username when available
    username = getattr(user, 'username', None) or getattr(user, 'email', None)
    return f"{user.__class__.__name__}:{username or str(user)}"


def attach_actor(sender, instance, history_instance, **kwargs):
    """Signal handler for simple_history.pre_create_historical_record.

    Behavior:
    - If the current request user is an instance of AUTH_USER_MODEL (Admin),
      set history_user to that user (keeps FK behavior).
    - Otherwise (e.g. a Client or external actor), leave history_user NULL
      and append a textual actor marker to history_change_reason so we
      preserve who made the change without violating the FK.
    """
    request = get_current_request()
    if not request:
        return

    user = getattr(request, 'user', None)
    UserModel = get_user_model()

    try:
        if user is not None and getattr(user, 'is_authenticated', False) and isinstance(user, UserModel):
            # Admin user: keep FK link
            history_instance.history_user = user
        else:
            # Non-Admin actor: avoid assigning incompatible FK and store a text
            history_instance.history_user = None
            actor = _actor_repr(user)
            old = getattr(history_instance, 'history_change_reason', None) or ''
            marker = f"actor={actor}"
            history_instance.history_change_reason = f"{old} {marker}".strip()
    except Exception:
        # Be conservative: on any error don't prevent history from being saved
        pass


pre_create_historical_record.connect(attach_actor)
