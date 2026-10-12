from pathlib import Path
import json
import os

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="استمارة الزيارة الإشرافية",
    page_icon="📝",
    layout="wide",
)

st.title("استمارة الزيارة الإشرافية")
st.caption("تعبئة نموذج الزيارة الصفية وحفظه أو تصديره بصيغة PDF.")

html_path = (
    Path(__file__).resolve().parent.parent
    / "supervisory-visit"
    / "public"
    / "index.html"
)
if not html_path.exists():
    st.error("تعذر العثور على ملف الاستمارة.")
    st.stop()

html = html_path.read_text(encoding="utf-8-sig")

worker_endpoint = os.getenv("SUPERVISORY_AI_ENDPOINT", "").strip()
if not worker_endpoint:
    try:
        worker_endpoint = str(st.secrets.get("SUPERVISORY_AI_ENDPOINT", "")).strip()
    except Exception:
        worker_endpoint = ""

if worker_endpoint:
    if not worker_endpoint.endswith("/api/ai"):
        worker_endpoint = worker_endpoint.rstrip("/") + "/api/ai"
    html = html.replace(
        'fetch("/api/ai"',
        f"fetch({json.dumps(worker_endpoint)}",
    )
else:
    st.info(
        "المساعد الذكي يحتاج إلى ضبط SUPERVISORY_AI_ENDPOINT بعد نشر "
        "خدمة Cloudflare Workers AI. بقية الاستمارة متاحة."
    )

components.html(html, height=1800, scrolling=True)
