import csv
from pathlib import Path


INCH_TO_MM = 25.4
BASE = Path(__file__).resolve().parent


def load_specifications():

    specifications = []

    with open(
        BASE / "specification_data.csv",
        "r",
        encoding="utf-8-sig"
    ) as file:

        reader = csv.DictReader(file)

        for row in reader:

            specifications.append(row)

    return specifications


def find_specification(
    specifications,
    item_a_type,
    item_b_type,
    condition
):

    for spec in specifications:

        spec_a = spec["Item_A_Type"].strip()
        spec_b = spec["Item_B_Type"].strip()
        spec_condition = spec["Condition"].strip()

        # 부품 순서가 동일한 경우
        same_order = (
            item_a_type == spec_a
            and item_b_type == spec_b
        )

        # 부품 순서가 반대인 경우도 허용
        reverse_order = (
            item_a_type == spec_b
            and item_b_type == spec_a
        )

        # 규격표에서 Condition이 비어 있으면
        # 조건과 상관없이 사용할 수 있음
        if spec_condition == "":
            condition_match = True

        else:
            condition_match = (
                condition == spec_condition
            )

        if (
            (same_order or reverse_order)
            and condition_match
        ):
            return spec

    return None


def calculate_minimum_clearance(spec, row):

    rule_type = spec["Rule_Type"].strip()

    rule_value = float(
        spec["Rule_Value"]
    )


    # -----------------------------
    # 1. 고정 거리 규격
    # -----------------------------

    if rule_type == "FIXED":

        unit = spec["Rule_Unit"].strip()

        if unit == "in":

            minimum_mm = (
                rule_value
                * INCH_TO_MM
            )

        elif unit == "mm":

            minimum_mm = rule_value

        else:

            raise ValueError(
                f"지원하지 않는 거리 단위: {unit}"
            )

        return minimum_mm


    # -----------------------------
    # 2. OD 배수 규격
    # -----------------------------

    elif rule_type == "MULTIPLIER":

        reference = (
            spec["Reference_Dimension"]
            .strip()
        )


        if reference == "WIRE_OD":

            value = row["Wire_OD_mm"]


        elif reference == "MAX_WIRE_OD":

            value = row["Max_Wire_OD_mm"]


        elif reference == "CABLE_OD":

            value = row["Cable_OD_mm"]


        else:

            raise ValueError(
                "지원하지 않는 OD 기준입니다."
            )


        if value is None or value.strip() == "":

            raise ValueError(
                f"{reference} 데이터가 없습니다."
            )


        od_mm = float(value)

        minimum_mm = (
            rule_value
            * od_mm
        )

        return minimum_mm


    else:

        raise ValueError(
            f"알 수 없는 Rule_Type: {rule_type}"
        )


def inspect_clearance():

    print(
        "\n=== Aircraft Clearance Inspection Tool 실행 ==="
    )

    all_results = []
    problems = []


    # -----------------------------
    # 규격 데이터 불러오기
    # -----------------------------

    try:

        specifications = load_specifications()

    except FileNotFoundError:

        print("\n[오류]")
        print(
            "specification_data.csv 파일을 찾을 수 없습니다."
        )

        return problems


    # -----------------------------
    # 측정 데이터 불러오기
    # -----------------------------

    try:

        file = open(
            BASE / "measurement_data.csv",
            "r",
            encoding="utf-8-sig"
        )

    except FileNotFoundError:

        print("\n[오류]")
        print(
            "measurement_data.csv 파일을 찾을 수 없습니다."
        )

        return problems


    with file:

        reader = csv.DictReader(file)


        for row in reader:

            item_a = row["Item_A"].strip()
            item_b = row["Item_B"].strip()

            item_a_type = (
                row["Item_A_Type"].strip()
            )

            item_b_type = (
                row["Item_B_Type"].strip()
            )

            condition = (
                row["Condition"].strip()
            )


            try:

                clearance = float(
                    row["Clearance_mm"]
                )

            except ValueError:

                print("\n[측정값 오류]")
                print(
                    item_a,
                    "-",
                    item_b
                )

                continue


            print("\n------------------------------")

            print(
                "검사 대상:",
                item_a,
                "-",
                item_b
            )

            print(
                "유형:",
                item_a_type,
                "/",
                item_b_type
            )

            if condition != "":

                print(
                    "조건:",
                    condition
                )

            print(
                "측정 거리:",
                clearance,
                "mm"
            )


            # -----------------------------
            # 규격 찾기
            # -----------------------------

            spec = find_specification(
                specifications,
                item_a_type,
                item_b_type,
                condition
            )


            if spec is None:

                print(
                    "결과: 규격 확인 필요"
                )

                print(
                    "해당 조합의 규격 데이터를 찾지 못했습니다."
                )

                continue


            # -----------------------------
            # 최소 요구거리 계산
            # -----------------------------

            try:

                minimum = (
                    calculate_minimum_clearance(
                        spec,
                        row
                    )
                )

            except ValueError as e:

                print(
                    "결과: 규격 계산 불가"
                )

                print(
                    "원인:",
                    e
                )

                continue


            minimum = round(
                minimum,
                3
            )


            print(
                "최소 요구 거리:",
                minimum,
                "mm"
            )

            print(
                "규격 근거:",
                spec["Source"]
            )


            # -----------------------------
            # OK / NG 판정
            # -----------------------------

            if clearance >= minimum:

                print("결과: OK")
                
                all_results.append({
                    "검사 대상": f"{item_a} - {item_b}",
                    "측정 거리": clearance,
                    "최소 요구 거리": minimum,
                    "부족 거리": 0,
                    "결과": "OK"
                })


            else:

                shortage = (
                    minimum
                    - clearance
                )

                shortage = round(
                    shortage,
                    3
                )


                print("결과: NG")
                
                all_results.append({
                    "검사 대상": f"{item_a} - {item_b}",
                    "측정 거리": clearance,
                    "최소 요구 거리": minimum,
                    "부족 거리": shortage,
                    "결과": "NG"
                })

                print(
                    "부족 거리:",
                    shortage,
                    "mm"
                )


                problems.append({

                    "item_a": item_a,

                    "item_b": item_b,

                    "type": (
                        item_a_type
                        + " / "
                        + item_b_type
                    ),

                    "condition": condition,

                    "item_a_type": item_a_type,
                    "item_b_type": item_b_type,
                    "rule_type": spec["Rule_Type"],
                    "rule_value": spec["Rule_Value"],
                    "rule_unit": spec["Rule_Unit"],
                    "reference_dimension": spec["Reference_Dimension"],
                    "wire_od_mm": row.get("Wire_OD_mm") or None,
                    "max_wire_od_mm": row.get("Max_Wire_OD_mm") or None,
                    "cable_od_mm": row.get("Cable_OD_mm") or None,

                    "clearance": clearance,

                    "minimum": minimum,

                    "deviation": shortage,

                    "issue":
                        "Clearance Shortage",

                    "source":
                        spec["Source"]
                })


    return all_results, problems
