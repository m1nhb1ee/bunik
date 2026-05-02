from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def standard_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get('request')
    request_id = getattr(request, 'request_id', None)

    if response is None:
        return Response(
            {
                'code': 'internal_server_error',
                'message': 'Internal server error',
                'details': None,
                'request_id': request_id,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    message = 'Request failed'
    if isinstance(response.data, dict):
        message = response.data.get('detail', message)

    response.data = {
        'code': f'http_{response.status_code}',
        'message': str(message),
        'details': response.data,
        'request_id': request_id,
    }
    return response
