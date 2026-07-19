import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.hints import build_fallback_marking_result

def test_fallback_marking_is_structured_and_reasonable():
    result = build_fallback_marking_result(
        problem_description='Solve $x^2 - 5x + 6 = 0$',
        text_answer='I factored it to $(x-2)(x-3)=0$ so $x=2$ or $x=3$.',
        image_base64=None,
    )

    assert result['totalMarks'] == 5
    assert 0 <= result['score'] <= 5
    assert isinstance(result['feedback'], str) and len(result['feedback']) > 0
    assert isinstance(result['steps'], list) and len(result['steps']) > 0
    assert 'transcription' in result
