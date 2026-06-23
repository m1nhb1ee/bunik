from src.academics.views import _is_scale_40, _normalized_thpt_score


def test_score_30_without_scale_note_stays_on_30_scale():
    assert _is_scale_40(30.0, None) is False


def test_scale_40_requires_explicit_note():
    assert _is_scale_40(30.0, 'thang diem 40') is True


def test_scale_40_recognizes_vietnamese_note():
    assert _is_scale_40(34.35, 'Thang \u0111i\u1ec3m 40') is True
    assert _is_scale_40(34.35, 'THANG \u0110I\u1ec2M 40') is True


def test_scale_40_recognizes_score_above_30_without_note():
    assert _is_scale_40(36.0, None) is True


def test_normalized_thpt_score_prefers_stored_value():
    row = {'score': 30, 'note': None, 'normalized_score': 22.5}
    assert _normalized_thpt_score(row) == 22.5
