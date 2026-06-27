"""
Copyright (c) 2020-2026 Gustavo Valiente gustavo.valiente@protonmail.com
zlib License, see LICENSE file.
"""


def remove_grit_timestamp(grit_data):
    output = ''

    for grit_line in grit_data.splitlines():
        if not grit_line.startswith('//	Time-stamp: '):
            output += grit_line
            output += '\n'

    return output

def write_file_if_changed(path, content):
    old_content = None

    try:
        with open(path, 'r') as file:
            old_content = file.read()
    except FileNotFoundError:
        pass

    if content != old_content:
        with open(path, 'w') as file:
            file.write(content)
