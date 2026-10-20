#!/usr/bin/env python3
"""
把审核通过（状态 = 公开）的五百句录音发布到网站，国内外都能直接播放。

用法（在 ay_hak 仓库根目录运行）：
    python3 tools/publish_recordings.py --sheet 录音表.csv --audio-dir 下载的录音文件夹

  --sheet      审核表格：从 Google 表格“AYHAK-五百句录音”下载为 CSV 或 xlsx。
               也可以是你自己整理的表（比如石墨表格、邮件收到的录音），只要有这些列：
               录音编号、句子编号、安远话写法、昵称、乡镇/村、同意公开、状态，
               以及“文件名”（录音文件的名字）或“文件 ID”。
  --audio-dir  录音文件所在的文件夹（例如从 Google Drive 下载的 AYHAK-Sentences，
               会自动查找子文件夹）。

它会：
  1. 只处理“状态”为“公开”、并且“同意公开”为“是”的行；
  2. 用 ffmpeg 把录音转成 m4a（苹果、安卓、电脑都能播），放进 audio/sentences/；
  3. 更新 data/recordings.json。之后把这两处的改动上传到 GitHub 即可。

状态改成“不公开”的录音会从 recordings.json 里去掉，并提示你可以删除对应文件。
需要 ffmpeg：macOS 上 `brew install ffmpeg`。没有 ffmpeg 时，m4a / mp3 文件会直接复制。
"""
import argparse, csv, json, os, re, shutil, subprocess, sys
from datetime import datetime

ROOT = os.getcwd()
OUT_DIR = os.path.join(ROOT, 'audio', 'sentences')
JSON_PATH = os.path.join(ROOT, 'data', 'recordings.json')
AUDIO_EXT = ('.webm', '.m4a', '.mp4', '.ogg', '.mp3', '.wav', '.aac', '.amr', '.3gp')


def read_sheet(path):
    if path.lower().endswith(('.xlsx', '.xlsm')):
        try:
            import openpyxl
        except ImportError:
            sys.exit('读取 xlsx 需要 openpyxl：pip install openpyxl；或者把表格另存为 CSV。')
        ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
        rows = [[('' if c is None else c) for c in r] for r in ws.iter_rows(values_only=True)]
    else:
        with open(path, encoding='utf-8-sig', newline='') as f:
            rows = list(csv.reader(f))
    head = [str(h).strip() for h in rows[0]]
    return [dict(zip(head, r)) for r in rows[1:] if any(str(c).strip() for c in r)]


def find_file(audio_dir, rid, name):
    want = str(name or '').strip()
    for dirpath, _, files in os.walk(audio_dir):
        for fn in files:
            if not fn.lower().endswith(AUDIO_EXT):
                continue
            if (want and fn == want) or (rid and rid in fn):
                return os.path.join(dirpath, fn)
    return None


def to_m4a(src, dst):
    if shutil.which('ffmpeg'):
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k', dst]
        subprocess.run(cmd, check=True)
        return dst
    if src.lower().endswith(('.m4a', '.mp4', '.mp3')):
        dst = os.path.splitext(dst)[0] + os.path.splitext(src)[1].lower().replace('.mp4', '.m4a')
        shutil.copyfile(src, dst)
        return dst
    sys.exit(f'没有找到 ffmpeg，无法转换 {os.path.basename(src)}。请先安装：brew install ffmpeg')


def date_str(v):
    if isinstance(v, datetime):
        return v.strftime('%Y-%m-%d')
    m = re.search(r'(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', str(v))
    return f'{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}' if m else ''


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--sheet', required=True)
    ap.add_argument('--audio-dir', required=True)
    a = ap.parse_args()
    if not os.path.isfile(JSON_PATH):
        sys.exit('请在 ay_hak 仓库的根目录运行（找不到 data/recordings.json）。')
    os.makedirs(OUT_DIR, exist_ok=True)

    data = json.load(open(JSON_PATH, encoding='utf-8'))
    published = {r['rid']: r for r in data.get('recordings', []) if r.get('rid')}
    added, kept, removed, missing = [], 0, [], []

    for row in read_sheet(a.sheet):
        rid = str(row.get('录音编号', '')).strip()
        sid = str(row.get('句子编号', '')).strip()
        status = str(row.get('状态', '')).strip()
        consent = str(row.get('同意公开', '')).strip() in ('是', 'yes', 'Yes', 'TRUE', 'true', '1')
        if not rid or not re.fullmatch(r's\d{3}', sid):
            continue
        if status != '公开' or not consent:
            if rid in published:
                removed.append(published.pop(rid))
            continue
        if rid in published and os.path.isfile(os.path.join(ROOT, published[rid]['file'])):
            kept += 1
            continue
        src = find_file(a.audio_dir, rid, row.get('文件名'))
        if not src:
            missing.append(rid)
            continue
        out = to_m4a(src, os.path.join(OUT_DIR, f'{sid}_{rid}.m4a'))
        published[rid] = {
            'rid': rid, 'sid': sid,
            'file': os.path.relpath(out, ROOT).replace(os.sep, '/'),
            'place': str(row.get('乡镇/村', '')).strip(),
            'nick': str(row.get('昵称', '')).strip(),
            'hanzi': str(row.get('安远话写法', '')).strip(),
            'date': date_str(row.get('时间', '')),
        }
        added.append(rid)

    data['recordings'] = sorted(published.values(), key=lambda r: (r['sid'], r['rid']))
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

    print(f'新发布 {len(added)} 条，已在网站上 {kept} 条，网站上共 {len(data["recordings"])} 条。')
    if missing:
        print('找不到录音文件（请确认已下载）：', '、'.join(missing))
    if removed:
        print('这些录音已改为不公开，已从网站列表去掉，可以删除对应文件：')
        for r in removed:
            print('  ', r['file'])
    print('下一步：把 audio/sentences/ 和 data/recordings.json 上传到 GitHub。')


if __name__ == '__main__':
    main()
