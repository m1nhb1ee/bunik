import logging
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


logger = logging.getLogger('django')


def standard_exception_handler(exc, context):
    response = exception_handler(exc, context)
    request = context.get('request')
    request_id = getattr(request, 'request_id', None)
    
    # Handle Supabase connection errors
    error_msg = str(exc).lower()
    is_supabase_error = any([
        'remoteprotocolerror' in error_msg,
        'server disconnected' in error_msg,
        'connection' in error_msg and 'supabase' not in error_msg.lower(),
    ])

    if response is None:
        # Log the exception for debugging
        logger.exception(f'Unhandled exception in {context.get("view")}', exc_info=exc)
        
        # Return 503 for Supabase connection errors (Service Unavailable)
        if is_supabase_error:
            return Response(
                {
                    'code': 'service_unavailable',
                    'message': 'Database service temporarily unavailable, please retry',
                    'details': None,
                    'request_id': request_id,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        
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
