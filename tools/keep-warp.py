#!/usr/bin/env python3
"""Hängt den WARP-Block einer alten Szenendatei an eine neu geschriebene Szene an.
Nutzung: python3 tools/keep-warp.py alt.html neu.html"""
import re, sys
old, new = open(sys.argv[1]).read(), open(sys.argv[2]).read()
m = re.search(r"/\* WARP START \*/.*?/\* WARP END \*/", old, re.S)
if not m or "/* WARP START */" in new:
    sys.exit(0)
new = new.replace("  </script>\n</template>", "  </script>\n  <script>\n    " + m.group(0) + "\n  </script>\n</template>")
open(sys.argv[2], "w").write(new)
