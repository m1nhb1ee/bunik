"""
Tool chuyển đổi file Excel (.xlsx) sang JSON.
Hỗ trợ chọn sheet, format output, pretty-print, và encoding UTF-8.

Cách sử dụng:
    python xlsx_to_json.py input.xlsx
    python xlsx_to_json.py input.xlsx -o output.json
    python xlsx_to_json.py input.xlsx -o output.json --sheet "Sheet1"
    python xlsx_to_json.py input.xlsx -o output.json --format table --indent 2
    python xlsx_to_json.py input.xlsx --all-sheets -o output_dir/
"""

import argparse
import json
import os
import sys
from datetime import datetime, date

import pandas as pd
import numpy as np


# ============================================================
# CUSTOM JSON ENCODER
# ============================================================

class DataFrameJSONEncoder(json.JSONEncoder):
    """Xử lý các kiểu dữ liệu đặc biệt từ pandas/numpy."""

    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        if obj is pd.NaT:
            return None
        return super().default(obj)


# ============================================================
# CORE FUNCTIONS
# ============================================================

def read_excel_sheet(filepath: str, sheet_name=None) -> dict[str, pd.DataFrame]:
    """
    Đọc file Excel, trả về dict {sheet_name: DataFrame}.
    Nếu sheet_name=None → đọc tất cả sheets.
    """
    if not os.path.isfile(filepath):
        print(f"❌ Lỗi: Không tìm thấy file '{filepath}'", file=sys.stderr)
        sys.exit(1)

    try:
        if sheet_name:
            df = pd.read_excel(filepath, sheet_name=sheet_name)
            return {sheet_name: df}
        else:
            # Đọc tất cả sheets
            all_sheets = pd.read_excel(filepath, sheet_name=None)
            return all_sheets
    except ValueError as e:
        print(f"❌ Lỗi: Sheet không tồn tại — {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Lỗi khi đọc file: {e}", file=sys.stderr)
        sys.exit(1)


def dataframe_to_dict(df: pd.DataFrame, fmt: str = "records") -> dict | list:
    """
    Chuyển DataFrame → dict/list theo format:
    - 'records': [{col1: val1, col2: val2}, ...]
    - 'table':   {columns: [...], data: [[val1, val2], ...]}
    """
    # Thay thế NaN bằng None
    df = df.where(pd.notnull(df), None)

    if fmt == "records":
        return df.to_dict(orient="records")
    elif fmt == "table":
        return {
            "columns": df.columns.tolist(),
            "data": df.values.tolist(),
        }
    else:
        raise ValueError(f"Format không hợp lệ: '{fmt}'. Chọn 'records' hoặc 'table'.")


def export_json(data, output_path: str, indent: int | None = None):
    """Ghi dữ liệu ra file JSON với encoding UTF-8."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent, cls=DataFrameJSONEncoder)
    print(f"✅ Đã xuất → {output_path}")


# ============================================================
# MAIN
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Chuyển đổi file Excel (.xlsx) sang JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python xlsx_to_json.py data.xlsx
  python xlsx_to_json.py data.xlsx -o result.json --indent 2
  python xlsx_to_json.py data.xlsx -o result.json --sheet "Điểm chuẩn"
  python xlsx_to_json.py data.xlsx --all-sheets -o output_folder/
  python xlsx_to_json.py data.xlsx --format table
        """,
    )

    parser.add_argument("input", help="Đường dẫn file Excel (.xlsx) cần chuyển đổi")
    parser.add_argument(
        "-o", "--output",
        help="Đường dẫn file JSON output (mặc định: tên file input + .json)",
    )
    parser.add_argument(
        "--sheet",
        default=None,
        help="Tên sheet cần export (mặc định: sheet đầu tiên)",
    )
    parser.add_argument(
        "--all-sheets",
        action="store_true",
        help="Export tất cả sheets. Output sẽ là dict {sheet_name: data}",
    )
    parser.add_argument(
        "--format",
        choices=["records", "table"],
        default="records",
        help="Format output: 'records' (mảng objects) hoặc 'table' (columns+data). Mặc định: records",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="Indent cho JSON output (mặc định: 2, dùng 0 để compact)",
    )

    args = parser.parse_args()

    # Xử lý indent
    indent = args.indent if args.indent > 0 else None

    # Xác định output path
    if args.output:
        output_path = args.output
    else:
        base_name = os.path.splitext(os.path.basename(args.input))[0]
        output_path = f"{base_name}.json"

    # Đọc Excel
    if args.all_sheets:
        sheets = read_excel_sheet(args.input, sheet_name=None)
    elif args.sheet:
        sheets = read_excel_sheet(args.input, sheet_name=args.sheet)
    else:
        # Mặc định: đọc tất cả nhưng chỉ lấy sheet đầu
        all_sheets = read_excel_sheet(args.input, sheet_name=None)
        first_name = list(all_sheets.keys())[0]
        sheets = {first_name: all_sheets[first_name]}

    # Chuyển đổi
    if args.all_sheets or len(sheets) > 1:
        # Multi-sheet: output là dict
        result = {}
        total_rows = 0
        for name, df in sheets.items():
            result[name] = dataframe_to_dict(df, fmt=args.format)
            total_rows += len(df)
            print(f"  📋 Sheet '{name}': {len(df)} dòng")
        export_json(result, output_path, indent=indent)
        print(f"  📊 Tổng: {total_rows} dòng từ {len(sheets)} sheets")
    else:
        # Single sheet
        name, df = next(iter(sheets.items()))
        result = dataframe_to_dict(df, fmt=args.format)
        export_json(result, output_path, indent=indent)
        print(f"  📋 Sheet '{name}': {len(df)} dòng")

    # Thống kê file size
    size_kb = os.path.getsize(output_path) / 1024
    print(f"  📦 Kích thước: {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
