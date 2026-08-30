from types import SimpleNamespace

from app.api.v1.trending import TrendingItemOut


def _item(extra):
    return SimpleNamespace(
        id=1,
        source="baidu",
        category="hot",
        rank=1,
        title="测试热榜",
        url="https://example.com/topic",
        hot_value=100,
        hot_value_raw="100",
        trend="up",
        cover_url=None,
        extra=extra,
    )


def test_trending_item_out_decodes_legacy_json_string_extra():
    item = TrendingItemOut.model_validate(_item('{"desc":"摘要","label":"热"}'))

    assert item.extra == {"desc": "摘要", "label": "热"}


def test_trending_item_out_drops_invalid_legacy_extra_without_breaking_list():
    item = TrendingItemOut.model_validate(_item("not-json"))

    assert item.extra is None
