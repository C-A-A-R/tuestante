import threading

_thread_locals = threading.local()


def get_current_request():
    """Return the current request stored in thread local (or None)."""
    return getattr(_thread_locals, 'request', None)


class HistoryRequestMiddleware:
    """Middleware that stores the current request in thread-local storage.

    This is used by our simple_history signal handler to access the acting
    user and, when the actor is not an instance of AUTH_USER_MODEL (e.g.
    a `Client` model), avoid assigning it to the historical FK and instead
    record a textual representation in the history_change_reason.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.request = request
        response = self.get_response(request)
        return response
