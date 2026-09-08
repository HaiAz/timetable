"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useData } from "@/components/data-provider";
import { useToast } from "@/components/ui/toast";
import { store } from "@/lib/store";
import { BASE_MINUTES_OPTIONS, type Student } from "@/lib/types";
import { formatVND, parseVND } from "@/lib/format";
import { sessionAmount } from "@/lib/billing";
import { suggestUnusedColor } from "@/lib/colors";
import { ColorGrid } from "./color-grid";

/**
 * Add or edit a student.
 *
 * Mounted only while open, and keyed by student id by the parent, so the form
 * state is initialised straight from props — no effect resetting state on
 * open, which would cause a cascading render.
 */
export function StudentDialog({
  student,
  onClose,
}: {
  /** `undefined` means "add new". */
  student?: Student;
  onClose: () => void;
}) {
  const { data, run } = useData();
  const { toast } = useToast();

  // Màu nào đang được học sinh khác dùng — để cảnh báo trùng.
  const usedBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const other of data.students) {
      if (other.id === student?.id) continue;
      if (other.color) map.set(other.color, other.name);
    }
    return map;
  }, [data.students, student?.id]);

  const [name, setName] = useState(student?.name ?? "");
  const [contact, setContact] = useState(student?.contact ?? "");
  const [baseMinutes, setBaseMinutes] = useState<number>(student?.baseMinutes ?? 60);
  const [priceText, setPriceText] = useState(
    student ? String(student.basePrice) : "",
  );
  const [note, setNote] = useState(student?.note ?? "");
  // Học sinh mới: gợi ý màu chưa ai dùng, đỡ phải tự tránh trùng.
  // Học sinh cũ: giữ đúng màu đang có (kể cả khi bỏ trống).
  const [color, setColor] = useState<string | undefined>(() =>
    student ? student.color : suggestUnusedColor(usedBy.keys()),
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const basePrice = parseVND(priceText);

  const errors = {
    name: !name.trim() ? "Hãy nhập tên học sinh." : undefined,
    basePrice:
      basePrice <= 0 ? "Học phí phải lớn hơn 0." : undefined,
  };
  const isValid = !errors.name && !errors.basePrice;

  async function save() {
    setTouched(true);
    if (!isValid) return;
    setSaving(true);

    const input = {
      name: name.trim(),
      contact: contact.trim(),
      baseMinutes,
      basePrice,
      note,
      color,
    };

    if (student) {
      await run(() => store.updateStudent(student.id, input));
      toast({ message: "Đã cập nhật học sinh.", tone: "success" });
    } else {
      await run(() => store.addStudent(input));
      toast({ message: "Đã thêm học sinh.", tone: "success" });
    }

    setSaving(false);
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={student ? "Sửa thông tin học sinh" : "Thêm học sinh"}
      description={
        student
          ? "Thay đổi đơn giá chỉ áp dụng cho các buổi học đánh dấu “đã dạy” từ nay về sau."
          : undefined
      }
      footer={
        <>
          <Button intent="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            intent="primary"
            onClick={() => void save()}
            loading={saving}
            disabled={touched && !isValid}
          >
            {student ? "Lưu thay đổi" : "Thêm học sinh"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Tên học sinh" required error={touched ? errors.name : undefined}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn An"
            aria-invalid={touched && Boolean(errors.name)}
            data-autofocus
          />
        </Field>

        <Field label="Liên hệ" hint="Số điện thoại, Zalo hoặc email. Không bắt buộc.">
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="0901 234 567"
            inputMode="tel"
          />
        </Field>

        {/* The rate — the number every calculation depends on */}
        <fieldset className="rounded-md border border-line bg-surface-inset p-3">
          <legend className="px-1 text-sm font-medium text-fg">Đơn giá</legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Đơn vị thời lượng">
              <Select
                value={baseMinutes}
                onChange={(e) => setBaseMinutes(Number(e.target.value))}
              >
                {BASE_MINUTES_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} phút
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Học phí"
              required
              error={touched ? errors.basePrice : undefined}
            >
              <Input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="200000"
                inputMode="numeric"
                aria-invalid={touched && Boolean(errors.basePrice)}
                className="font-mono tnum"
              />
            </Field>
          </div>

          {/* Live confirmation of what the rate means in practice */}
          <p className="mt-2.5 border-t border-line pt-2.5 text-sm text-fg-muted" aria-live="polite">
            {basePrice > 0 ? (
              <>
                <span className="font-medium text-fg">
                  {baseMinutes} phút — {formatVND(basePrice)}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-fg-subtle">
                  Ví dụ: một buổi 90 phút ={" "}
                  {formatVND(sessionAmount(90, { baseMinutes, basePrice }))}
                </span>
              </>
            ) : (
              "Nhập học phí để xem ví dụ tính tiền."
            )}
          </p>
        </fieldset>

        {/* Màu — nhận diện học sinh trên thời khoá biểu */}
        <Field label="Màu trên thời khoá biểu">
          <ColorGrid value={color} onChange={setColor} usedBy={usedBy} />
        </Field>

        <Field label="Ghi chú" hint="Lớp, trường, môn học, lưu ý riêng…">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Lớp 9, ôn thi vào 10, môn Toán"
          />
        </Field>
      </div>
    </Dialog>
  );
}
