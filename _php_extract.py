#!/usr/bin/env python3
"""Extract backend actions from PHP files (POST/GET, SQL, roles, notifications)."""
import re
import os

BASE = r"c:\Users\HUAWEI\Desktop\RWVCA_PROJECT\rwvca-platform-php"
OUT = r"c:\Users\HUAWEI\Desktop\RWVCA_PROJECT\BACKEND\_php_inventory.txt"

FILES = [
    "dashboard1/update_requisition_status.php",
    "dashboard1/process_requisition.php",
    "dashboard1/requisitions.php",
    "dashboard1/requisitions_api.php",
    "dashboard1/update_special_requisition_status.php",
    "dashboard1/process_special_requisition.php",
    "dashboard1/special_requisitions.php",
    "dashboard1/leave_request.php",
    "dashboard1/leave_request_list.php",
    "dashboard1/leave_request_details.php",
    "dashboard1/leave_schedule.php",
    "dashboard1/leave_schedule_replies.php",
    "dashboard1/mission.php",
    "dashboard1/mission_list.php",
    "dashboard1/mission_request_details.php",
    "dashboard1/todo_ajax.php",
    "dashboard1/todos.php",
    "dashboard1/ed_notes.php",
    "dashboard1/attendance.php",
    "dashboard1/inventory.php",
    "dashboard1/asset_form.php",
    "dashboard1/document_create.php",
    "dashboard1/document_list.php",
    "dashboard1/document_view.php",
    "dashboard1/report-create.php",
    "dashboard1/report-list.php",
    "dashboard1/membership-report-create.php",
    "dashboard1/members-management.php",
    "dashboard1/add_member.php",
    "dashboard1/ticketing.php",
    "dashboard1/communication.php",
    "dashboard1/create_communication.php",
    "dashboard1/permissions.php",
    "dashboard1/users-profile.php",
    "dashboard1/overview.php",
    "dashboard1/index.php",
    "dashboard1/web.php",
    "dashboard1/manage_all_about_membership.php",
    "register.php",
    "signup_handler.php",
]

ED_DIR = os.path.join(BASE, "dashboard1", "ED_ALL_ACCESS_COMPONENTS")

PATTERNS = {
    "POST": re.compile(r"\$_POST\s*(?:\[['\"]([^'\"]+)['\"]\]|->\{['\"]([^'\"]+)['\"]\}|->(\w+)|\[(['\"])([^'\"]+)\4\])"),
    "POST_SIMPLE": re.compile(r"\$_POST\[['\"]([^'\"]+)['\"]\]"),
    "GET_SIMPLE": re.compile(r"\$_GET\[['\"]([^'\"]+)['\"]\]"),
    "REQUEST": re.compile(r"\$_REQUEST\[['\"]([^'\"]+)['\"]\]"),
    "FILES": re.compile(r"\$_FILES\[['\"]([^'\"]+)['\"]\]"),
    "FILTER_POST": re.compile(r"filter_input\(\s*INPUT_POST\s*,\s*['\"]([^'\"]+)['\"]"),
    "FILTER_GET": re.compile(r"filter_input\(\s*INPUT_GET\s*,\s*['\"]([^'\"]+)['\"]"),
    "INSERT": re.compile(r"INSERT\s+INTO\s+[`'\"]?(\w+)[`'\"]?", re.I),
    "UPDATE": re.compile(r"UPDATE\s+[`'\"]?(\w+)[`'\"]?\s+SET", re.I),
    "DELETE": re.compile(r"DELETE\s+FROM\s+[`'\"]?(\w+)[`'\"]?", re.I),
    "FROM": re.compile(r"FROM\s+[`'\"]?(\w+)[`'\"]?", re.I),
    "JOIN": re.compile(r"JOIN\s+[`'\"]?(\w+)[`'\"]?", re.I),
    "ROLE": re.compile(r"(role|SESSION\[['\"]role['\"]\]|user_role).{0,80}", re.I),
    "NAME_ATTR": re.compile(r'name=["\']([^"\']+)["\']'),
    "ACTION_CASE": re.compile(r"case\s+['\"]([^'\"]+)['\"]\s*:"),
    "ACTION_EQ": re.compile(r"action['\"]?\s*===?\s*['\"]([^'\"]+)['\"]"),
    "METHOD": re.compile(r"REQUEST_METHOD['\"]?\s*===?\s*['\"](POST|GET|PUT|DELETE)['\"]"),
}

def extract_php_blocks(text):
    """Keep PHP and JS fetch/ajax snippets; drop huge HTML style."""
    php = re.findall(r"<\?php(.*?)\?>", text, re.S)
    if not php:
        # file is mostly php
        if text.strip().startswith("<?php"):
            return [text]
    # also keep inline JS with fetch/ajax
    js = re.findall(r"<script[^>]*>(.*?)</script>", text, re.S | re.I)
    js_rel = [b for b in js if re.search(r"fetch\(|ajax|XMLHttpRequest|\$_POST|FormData", b, re.I)]
    return php + js_rel

def uniq(seq):
    seen = set()
    out = []
    for x in seq:
        if x not in seen and x:
            seen.add(x)
            out.append(x)
    return out

def analyze(path, rel):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except Exception as e:
        return f"=== {rel} ERROR {e} ===\n"

    size = len(text)
    lines = text.count("\n") + 1
    php_parts = extract_php_blocks(text)
    php_text = "\n".join(php_parts) if php_parts else text

    posts = uniq(PATTERNS["POST_SIMPLE"].findall(php_text) + PATTERNS["FILTER_POST"].findall(php_text))
    gets = uniq(PATTERNS["GET_SIMPLE"].findall(php_text) + PATTERNS["FILTER_GET"].findall(php_text))
    files = uniq(PATTERNS["FILES"].findall(php_text))
    names = uniq(PATTERNS["NAME_ATTR"].findall(text))
    # filter html noise
    names = [n for n in names if not n.startswith("csrf") or True]
    inserts = uniq(PATTERNS["INSERT"].findall(php_text))
    updates = uniq(PATTERNS["UPDATE"].findall(php_text))
    deletes = uniq(PATTERNS["DELETE"].findall(php_text))
    froms = uniq(PATTERNS["FROM"].findall(php_text))
    joins = uniq(PATTERNS["JOIN"].findall(php_text))
    cases = uniq(PATTERNS["ACTION_CASE"].findall(php_text))
    action_eq = uniq(PATTERNS["ACTION_EQ"].findall(php_text))
    methods = uniq(PATTERNS["METHOD"].findall(php_text))

    notif = []
    for m in re.finditer(r"INSERT INTO notifications.{0,400}", php_text, re.I | re.S):
        notif.append(re.sub(r"\s+", " ", m.group(0))[:350])
    notif_calls = uniq(re.findall(r"(createSystemNotification|vu_notify_\w+|notify\w*|sendEmail\w*)\s*\(", php_text))

    # role snippets
    roles = uniq(re.findall(r"['\"]((?:admin|ed|hr|finance|employee|accountant|logistic|membership|coordinator|supervisor)[^'\"]*)['\"]", php_text, re.I))
    role_checks = uniq([re.sub(r"\s+", " ", m.group(0))[:200] for m in re.finditer(
        r"if\s*\([^)]{0,20}(role|SESSION\[['\"]role)[^)]{0,180}\)", php_text, re.I)])

    # COUNT queries
    counts = uniq([re.sub(r"\s+", " ", m.group(0))[:250] for m in re.finditer(
        r"SELECT\s+COUNT\([^)]*\)[^;]{0,200}", php_text, re.I)])

    # status arrays
    status_blocks = [re.sub(r"\s+", " ", m.group(0))[:500] for m in re.finditer(
        r"\$validStatuses\s*=\s*\[[^\]]{0,800}\]", php_text, re.S)]

    # form action
    form_actions = uniq(re.findall(r'<form[^>]*action=["\']([^"\']+)["\']', text, re.I))
    fetch_urls = uniq(re.findall(r'fetch\(["\']([^"\']+)["\']', text, re.I))
    ajax_urls = uniq(re.findall(r'(?:url\s*:\s*|ajax\([^)]*)["\']([^"\']+\.php[^"\']*)["\']', text, re.I))

    # POST handling start
    post_if = uniq([re.sub(r"\s+", " ", m.group(0))[:180] for m in re.finditer(
        r"if\s*\(\s*\$_SERVER\[['\"]REQUEST_METHOD['\"]\]\s*===?\s*['\"]POST['\"]", php_text)])

    out = []
    out.append("=" * 80)
    out.append(f"FILE: {rel}  size={size} lines={lines}")
    out.append(f"METHODS: {methods or ['(page mix)']}")
    out.append(f"FORM_ACTIONS: {form_actions}")
    out.append(f"FETCH/AJAX: {fetch_urls + ajax_urls}")
    out.append(f"ACTION_CASES: {cases}")
    out.append(f"ACTION_EQ: {action_eq}")
    out.append(f"POST_KEYS: {posts}")
    out.append(f"GET_KEYS: {gets}")
    out.append(f"FILES: {files}")
    out.append(f"FORM_NAMES (first 80): {names[:80]}")
    out.append(f"INSERT: {inserts}")
    out.append(f"UPDATE: {updates}")
    out.append(f"DELETE: {deletes}")
    out.append(f"FROM: {froms}")
    out.append(f"JOIN: {joins}")
    out.append(f"NOTIF_INSERTS: {notif}")
    out.append(f"NOTIF_CALLS: {notif_calls}")
    out.append(f"ROLES_STRINGS: {roles}")
    out.append(f"ROLE_CHECKS: {role_checks[:15]}")
    out.append(f"COUNTS: {counts[:20]}")
    out.append(f"STATUS_TRANSITIONS: {status_blocks}")
    out.append(f"POST_IF: {post_if}")

    # dump non-html php lines that look like business logic
    interesting = []
    for i, line in enumerate(php_text.splitlines(), 1):
        s = line.strip()
        if not s or s.startswith("//") or s.startswith("*") or s.startswith("/*"):
            continue
        if re.search(r"(INSERT |UPDATE |DELETE |SELECT |status|role|notification|approval|workflow|$_POST|$_GET|action|bind_param|prepare\()", s, re.I):
            if "style" in s.lower() or "bootstrap" in s.lower():
                continue
            interesting.append(f"  L{i}: {s[:240]}")
    out.append("LOGIC_SNIPS:")
    out.extend(interesting[:250])
    out.append("")
    return "\n".join(out) + "\n"

def main():
    chunks = []
    for rel in FILES:
        path = os.path.join(BASE, *rel.split("/"))
        chunks.append(analyze(path, rel))

    chunks.append("=" * 80)
    chunks.append("ED_ALL_ACCESS_COMPONENTS")
    if os.path.isdir(ED_DIR):
        for name in sorted(os.listdir(ED_DIR)):
            path = os.path.join(ED_DIR, name)
            if os.path.isfile(path) and name.endswith(".php"):
                chunks.append(analyze(path, "dashboard1/ED_ALL_ACCESS_COMPONENTS/" + name))

    # helpers referenced by special requisitions
    for extra in [
        "dashboard1/includes/vu_mission_helpers.php",
        "dashboard1/includes/special_requisition_schema.php",
        "dashboard1/leave_schedule_notifications.php",
        "dashboard1/create_notifications.php",
        "create_notifications.php",
    ]:
        path = os.path.join(BASE, *extra.split("/"))
        if os.path.isfile(path):
            chunks.append(analyze(path, extra))

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(chunks))
    print("WROTE", OUT, "chars", os.path.getsize(OUT))

if __name__ == "__main__":
    main()
