import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface EditableBalanceProps {
  balance: number;
  currencyPrefix?: string;
  onSave: (newBalance: number) => Promise<void>;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function parseFormattedNumber(str: string): number {
  const cleaned = str.replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

export function EditableBalance({ balance, currencyPrefix = '$', onSave }: EditableBalanceProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleEdit = () => {
    setInputValue(formatNumber(balance));
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setInputValue('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.,]/g, '');
    const num = parseFormattedNumber(raw);
    if (num >= 0) {
      setInputValue(formatNumber(num));
    }
  };

  const handleSave = async () => {
    const num = parseFormattedNumber(inputValue);
    if (num < 0) {
      toast.error('0 이상의 금액을 입력해주세요.');
      return;
    }
    if (num > 999999999) {
      toast.error('금액이 너무 큽니다.');
      return;
    }
    setSaving(true);
    try {
      await onSave(num);
      toast.success(`잔고가 ${currencyPrefix}${formatNumber(num)}으로 변경되었습니다.`);
      setEditing(false);
    } catch {
      toast.error('잔고 변경 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold">{currencyPrefix}</span>
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="h-8 w-[140px] text-sm font-mono font-bold"
          disabled={saving}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={saving}>
          <Check className="w-3.5 h-3.5 text-stock-up" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancel} disabled={saving}>
          <X className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <p className="text-xl font-bold font-mono">
        {currencyPrefix}{formatNumber(balance)}
      </p>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleEdit}
      >
        <Pencil className="w-3 h-3 text-muted-foreground" />
      </Button>
    </div>
  );
}