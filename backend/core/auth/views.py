import logging
from datetime import date

from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.auth.serializers import (
    AchievementCreateSerializer,
    AchievementSerializer,
    AwardSerializer,
    CertificateCreateSerializer,
    CertificateSerializer,
    FinalizeProfileSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    SubjectProfileUpdateSerializer,
    UserProfileSerializer,
)
from core.auth.supabase_auth import SupabaseAuthentication
from core.errors.classification import (
    is_duplicate_error,
    is_invalid_credentials_error,
    is_missing_column_error,
    is_rate_limited_error,
    is_rls_error,
)
from core.supabase_client import get_client, get_service_client, get_user_client, revoke_session


logger = logging.getLogger(__name__)


def _profile_by_id(client, user_id):
    try:
        return client.table('users').select('*').eq('id', user_id).maybe_single().execute()
    except Exception:
        logger.exception('Failed to fetch profile.')
        raise


def _score_by_user_id(client, user_id):
    try:
        return client.table('score').select('*').eq('user_id', user_id).maybe_single().execute()
    except Exception:
        logger.exception('Failed to fetch score profile.')
        raise


def _merge_user_profile(user_row, score_row):
    merged = dict(user_row or {})
    score_data = score_row or {}
    for key in ('math', 'literature', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography', 'base_score'):
        if key in score_data:
            merged[key] = score_data.get(key)
    return merged


def _enrich_achievements_with_awards(client, achievements):
    if not achievements:
        return []
    award_ids = list({item.get('award_id') for item in achievements if item.get('award_id') is not None})
    awards_map = {}
    if award_ids:
        awards_resp = client.table('awards').select('*').in_('id', award_ids).execute()
        for row in (awards_resp.data or []):
            awards_map[row.get('id')] = {
                'id': row.get('id'),
                'name': row.get('name'),
                'level': row.get('level'),
            }

    result = []
    for item in achievements:
        result.append({
            'id': item.get('id'),
            'user_id': item.get('user_id'),
            'award_id': item.get('award_id'),
            'name': item.get('name'),
            'prize': item.get('prize'),
            'date': item.get('date'),
            'is_verified': item.get('is_verified'),
            'awards': awards_map.get(item.get('award_id')),
        })
    return result


def _profile_conflict_exists(client, *, user_name: str, gmail: str, exclude_user_id=None) -> bool:
    response = (
        client
        .table('users')
        .select('id')
        .or_(f'user_name.eq.{user_name},gmail.eq.{gmail}')
        .limit(2 if exclude_user_id is not None else 1)
        .execute()
    )
    rows = response.data or []
    if exclude_user_id is None:
        return bool(rows)
    return any(str(row.get('id')) != str(exclude_user_id) for row in rows)


def _profile_payload(user_id, data, gmail=None):
    return {
        'id': user_id,
        'user_name': data['user_name'],
        'full_name': data['full_name'],
        'grade': data['grade'],
        'dob': data['dob'].isoformat(),
        'gender': data['gender'],
        'gmail': gmail or data['gmail'],
    }


def _delete_auth_user_if_possible(user_id):
    if not user_id:
        return
    try:
        get_service_client().auth.admin.delete_user(user_id)
    except Exception as exc:
        logger.warning('Could not clean up Supabase auth user %s: %s', user_id, exc)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user_id = None
        try:
            auth_client = get_client()
            if _profile_conflict_exists(auth_client, user_name=data['user_name'], gmail=data['gmail']):
                return Response({'message': 'gmail hoac user_name da ton tai'}, status=status.HTTP_409_CONFLICT)

            auth_resp = auth_client.auth.sign_up({'email': data['gmail'], 'password': data['password']})
            user_id = auth_resp.user.id if auth_resp and auth_resp.user else None
            if not user_id:
                logger.error('Supabase sign_up did not return user id.')
                return Response({'message': 'Dang ky that bai'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            profile_payload = _profile_payload(user_id, data)
            access_token = auth_resp.session.access_token if auth_resp and auth_resp.session else None
            if not access_token:
                return Response(
                    {
                        'message': 'Can xac minh email truoc khi tao ho so nguoi dung.',
                        'user_id': user_id,
                        'requires_email_confirmation': True,
                    },
                    status=status.HTTP_202_ACCEPTED,
                )
            get_user_client(access_token).table('users').insert(profile_payload).execute()
            user_data = UserProfileSerializer(profile_payload).data
            return Response(
                {'message': 'Dang ky thanh cong', 'user': user_data, 'access_token': access_token},
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            logger.exception('Register failed.')
            _delete_auth_user_if_possible(user_id)
            if is_duplicate_error(exc):
                return Response({'message': 'gmail hoac user_name da ton tai'}, status=status.HTTP_409_CONFLICT)
            if is_rate_limited_error(exc):
                return Response(
                    {'message': 'Ban thao tac qua nhanh. Vui long thu lai sau vai giay.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
            if is_rls_error(exc):
                return Response(
                    {'message': 'Khong the tao ho so nguoi dung do cau hinh quyen du lieu.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FinalizeProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def post(self, request):
        serializer = FinalizeProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user_id = getattr(request.user, 'id', None)
        gmail = getattr(request.user, 'email', None)
        access_token = request.auth
        if not user_id or not gmail or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            client = get_user_client(access_token)
            if _profile_conflict_exists(client, user_name=data['user_name'], gmail=gmail, exclude_user_id=user_id):
                return Response({'message': 'gmail hoac user_name da ton tai'}, status=status.HTTP_409_CONFLICT)
            payload = _profile_payload(user_id, data, gmail=gmail)
            response = client.table('users').upsert(payload, on_conflict='id').execute()
            user_data = (response.data or [payload])[0]
            return Response(
                {'message': 'Tao ho so nguoi dung thanh cong', 'user': UserProfileSerializer(user_data).data},
                status=status.HTTP_201_CREATED,
            )
        except Exception as exc:
            logger.exception('Finalize profile failed.')
            if is_duplicate_error(exc):
                return Response({'message': 'gmail hoac user_name da ton tai'}, status=status.HTTP_409_CONFLICT)
            if is_rls_error(exc):
                return Response(
                    {'message': 'Khong the tao ho so nguoi dung do cau hinh quyen du lieu.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        auth_client = get_client()
        try:
            auth_resp = auth_client.auth.sign_in_with_password({'email': data['gmail'], 'password': data['password']})
            if not auth_resp or not auth_resp.session:
                return Response({'message': 'Sai tai khoan hoac mat khau'}, status=status.HTTP_401_UNAUTHORIZED)
            user_id = auth_resp.user.id if auth_resp.user else None
            if not user_id:
                logger.error('Supabase sign_in did not return user id.')
                return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            profile_client = get_user_client(auth_resp.session.access_token)
            profile_resp = _profile_by_id(profile_client, user_id)
            if not profile_resp.data:
                logger.error('Profile missing for gmail=%s', data['gmail'])
                return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            score_resp = _score_by_user_id(profile_client, user_id)
            merged_profile = _merge_user_profile(profile_resp.data, score_resp.data if score_resp else None)
            return Response(
                {
                    'message': 'Dang nhap thanh cong',
                    'user': UserProfileSerializer(merged_profile).data,
                    'access_token': auth_resp.session.access_token,
                    'refresh_token': auth_resp.session.refresh_token,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as exc:
            logger.exception('Login failed.')
            if is_invalid_credentials_error(exc):
                return Response({'message': 'Sai tai khoan hoac mat khau'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def get(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            client = get_user_client(access_token)
            profile_resp = _profile_by_id(client, user_id)
            if not profile_resp.data:
                return Response({'message': 'Khong tim thay nguoi dung'}, status=status.HTTP_401_UNAUTHORIZED)
            score_resp = _score_by_user_id(client, user_id)
            merged_profile = _merge_user_profile(profile_resp.data, score_resp.data if score_resp else None)
            return Response({'user': UserProfileSerializer(merged_profile).data}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Profile lookup failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def put(self, request):
        return self._update(request, partial=False)

    def patch(self, request):
        return self._update(request, partial=True)

    def _update(self, request, partial: bool):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = ProfileUpdateSerializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        if not payload:
            return Response({'message': 'Khong co du lieu de cap nhat'}, status=status.HTTP_400_BAD_REQUEST)

        if 'dob' in payload:
            payload['dob'] = payload['dob'].isoformat()

        try:
            client = get_user_client(access_token)
            user_fields = {
                key: value for key, value in payload.items()
                if key in {'user_name', 'full_name', 'grade', 'dob', 'gender', 'is_special', 'special_subject', 'special_score'}
            }
            score_fields = {
                key: value for key, value in payload.items()
                if key in {'math', 'literature', 'english', 'physics', 'chemistry', 'biology', 'history', 'geography'}
            }

            if user_fields:
                try:
                    resp = (
                        client.table('users')
                        .update(user_fields)
                        .eq('id', user_id)
                        .execute()
                    )
                except Exception as exc:
                    # Let profile saves continue on environments where the DB column
                    # has not been added yet, instead of hard-failing the whole form.
                    if 'special_subject' in user_fields and is_missing_column_error(exc, 'special_subject'):
                        fallback_fields = {key: value for key, value in user_fields.items() if key != 'special_subject'}
                        if not fallback_fields:
                            raise
                        resp = (
                            client.table('users')
                            .update(fallback_fields)
                            .eq('id', user_id)
                            .execute()
                        )
                    else:
                        raise
                updated = (resp.data or [None])[0]
                if not updated:
                    return Response({'message': 'Khong tim thay nguoi dung'}, status=status.HTTP_404_NOT_FOUND)

            if score_fields:
                score_payload = {'user_id': user_id, **score_fields}
                client.table('score').upsert(score_payload, on_conflict='user_id').execute()

            profile_resp = _profile_by_id(client, user_id)
            if not profile_resp.data:
                return Response({'message': 'Khong tim thay nguoi dung'}, status=status.HTTP_404_NOT_FOUND)
            score_resp = _score_by_user_id(client, user_id)
            merged_profile = _merge_user_profile(profile_resp.data, score_resp.data if score_resp else None)
            return Response({'message': 'Cap nhat ho so thanh cong', 'user': UserProfileSerializer(merged_profile).data}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Profile update failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _get_subject_profile(client, user_id):
    subjects = (
        client.table('school_subjects')
        .select('*')
        .eq('is_active', True)
        .order('curriculum_group')
        .order('code')
        .execute()
    )
    selections = (
        client.table('user_elective_subjects')
        .select('subject_code')
        .eq('user_id', user_id)
        .execute()
    )
    results = (
        client.table('user_subject_results')
        .select('subject_code,numeric_score,assessment_status,updated_at')
        .eq('user_id', user_id)
        .execute()
    )
    academic_score_response = client.rpc('get_user_academic_score').execute()
    academic_score = academic_score_response.data or {}
    if isinstance(academic_score, list):
        academic_score = academic_score[0] if academic_score else {}
    return {
        'subjects': subjects.data or [],
        'selected_elective_codes': [item['subject_code'] for item in (selections.data or [])],
        'results': results.data or [],
        'academic_score': academic_score,
    }


class SubjectProfileView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def get(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            client = get_user_client(access_token)
            return Response(_get_subject_profile(client, user_id), status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Subject profile lookup failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def patch(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = SubjectProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data
        rpc_results = [
            {
                'subject_code': item['subject_code'],
                'numeric_score': item.get('numeric_score'),
                'assessment_status': item.get('assessment_status'),
            }
            for item in payload['results']
        ]

        try:
            client = get_user_client(access_token)
            client.rpc('save_user_subject_profile', {
                'p_elective_codes': payload['elective_codes'],
                'p_results': rpc_results,
            }).execute()
            return Response(_get_subject_profile(client, user_id), status=status.HTTP_200_OK)
        except Exception as exc:
            if '22023' in str(exc):
                return Response({'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            logger.exception('Subject profile update failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AwardCatalogView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            client = get_client()
            try:
                auth_result = SupabaseAuthentication().authenticate(request)
            except AuthenticationFailed:
                auth_result = None
            if auth_result:
                _user, token = auth_result
                client = get_user_client(token)
            resp = client.table('awards').select('*').order('id').execute()
            rows = []
            for row in (resp.data or []):
                rows.append({
                    'id': row.get('id'),
                    'name': row.get('name'),
                    'level': row.get('level'),
                })
            return Response({'results': AwardSerializer(rows, many=True).data}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception('Award catalog lookup failed.')
            if is_rls_error(exc):
                return Response({'message': 'Khong co quyen truy cap danh muc giai thuong'}, status=status.HTTP_403_FORBIDDEN)
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AchievementListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def get(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            client = get_user_client(access_token)
            resp = client.table('achievements').select('*').eq('user_id', user_id).order('id').execute()
            data = _enrich_achievements_with_awards(client, resp.data or [])
            return Response({'results': AchievementSerializer(data, many=True).data}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Achievement lookup failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = AchievementCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            client = get_user_client(access_token)
            award_id = serializer.validated_data['award_id']
            award_resp = client.table('awards').select('id, name').eq('id', award_id).maybe_single().execute()
            if not award_resp.data:
                return Response({'message': 'Khong tim thay danh muc giai thuong'}, status=status.HTTP_400_BAD_REQUEST)
            payload = {
                'user_id': user_id,
                'award_id': award_id,
                'name': award_resp.data.get('name'),
                'prize': serializer.validated_data.get('prize'),
                'date': (serializer.validated_data.get('date') or date.today()).isoformat(),
            }

            create_resp = client.table('achievements').insert(payload).execute()
            created = (create_resp.data or [None])[0]
            if not created:
                return Response({'message': 'Khong the them giai thuong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            full_resp = client.table('achievements').select('*').eq('id', created['id']).maybe_single().execute()
            enriched = _enrich_achievements_with_awards(client, [full_resp.data] if full_resp.data else [])
            achievement = enriched[0] if enriched else None
            return Response({'message': 'Them giai thuong thanh cong', 'achievement': AchievementSerializer(achievement).data if achievement else None}, status=status.HTTP_201_CREATED)
        except Exception:
            logger.exception('Achievement create failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AchievementDeleteView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def delete(self, request, achievement_id: int):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            resp = (
                get_user_client(access_token)
                .table('achievements')
                .delete()
                .eq('id', achievement_id)
                .eq('user_id', user_id)
                .execute()
            )
            if not resp.data:
                return Response({'message': 'Khong tim thay giai thuong'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'message': 'Xoa giai thuong thanh cong'}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Achievement delete failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CertificateListCreateView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def get(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            client = get_user_client(access_token)
            resp = client.table('certificates').select('*').eq('user_id', user_id).order('id').execute()
            return Response({'results': CertificateSerializer(resp.data or [], many=True).data}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Certificate lookup failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = CertificateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = {
            'user_id': user_id,
            'name': serializer.validated_data['name'],
            'score': serializer.validated_data.get('score'),
        }
        if serializer.validated_data.get('date'):
            payload['date'] = serializer.validated_data['date'].isoformat()

        try:
            client = get_user_client(access_token)
            create_resp = client.table('certificates').insert(payload).execute()
            created = (create_resp.data or [None])[0]
            if not created:
                return Response({'message': 'Khong the them chung chi'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(
                {'message': 'Them chung chi thanh cong', 'certificate': CertificateSerializer(created).data},
                status=status.HTTP_201_CREATED,
            )
        except Exception:
            logger.exception('Certificate create failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CertificateDeleteView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def delete(self, request, certificate_id: int):
        user_id = getattr(request.user, 'id', None)
        access_token = request.auth
        if not user_id or not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            resp = (
                get_user_client(access_token)
                .table('certificates')
                .delete()
                .eq('id', certificate_id)
                .eq('user_id', user_id)
                .execute()
            )
            if not resp.data:
                return Response({'message': 'Khong tim thay chung chi'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'message': 'Xoa chung chi thanh cong'}, status=status.HTTP_200_OK)
        except Exception:
            logger.exception('Certificate delete failed.')
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = [SupabaseAuthentication]

    def post(self, request):
        access_token = request.auth
        if not access_token:
            return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            revoke_session(access_token)
            return Response({'message': 'Dang xuat thanh cong'}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception('Logout failed.')
            if is_invalid_credentials_error(exc):
                return Response({'message': 'Token khong hop le'}, status=status.HTTP_401_UNAUTHORIZED)
            return Response({'message': 'Da xay ra loi he thong'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
