import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { addMonths, parseDate } from '../domain/dates';
import { Sheet } from './Sheet';

export function MonthPicker({
  selected,
  initialStep,
  onSelect,
  onClose,
}: {
  selected: string;
  initialStep: 'year' | 'month';
  onSelect(date: string): void;
  onClose(): void;
}) {
  const date = parseDate(selected);
  const currentYear = date.getUTCFullYear();
  const currentMonth = date.getUTCMonth();
  const [year, setYear] = useState(currentYear);
  const [step, setStep] = useState(initialStep);
  const [start, setStart] = useState(1900 + Math.floor((currentYear - 1900) / 12) * 12);
  const end = Math.min(start + 11, 2100);
  const showYears = () => {
    setStart(1900 + Math.floor((year - 1900) / 12) * 12);
    setStep('year');
  };
  return (
    <Sheet title="选择年月" onClose={onClose}>
      <div className="month-picker">
        <div className="picker-navigation">
          <button
            type="button"
            className="icon-button"
            aria-label={step === 'year' ? '上一组年份' : '上一年'}
            disabled={step === 'year' ? start === 1900 : year === 1900}
            onClick={() => (step === 'year' ? setStart(start - 12) : setYear(year - 1))}
          >
            <ChevronLeft />
          </button>
          {step === 'year' ? (
            <strong aria-live="polite">
              {start} — {end} 年
            </strong>
          ) : (
            <button type="button" className="picker-year" onClick={showYears}>
              {year} 年 <span>选择年份</span>
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={step === 'year' ? '下一组年份' : '下一年'}
            disabled={step === 'year' ? end === 2100 : year === 2100}
            onClick={() => (step === 'year' ? setStart(start + 12) : setYear(year + 1))}
          >
            <ChevronRight />
          </button>
        </div>
        <fieldset className="picker-grid" key={step} aria-label={step === 'year' ? '年份' : '月份'}>
          {step === 'year'
            ? Array.from({ length: end - start + 1 }, (_, index) => start + index).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={value === year}
                  onClick={() => {
                    setYear(value);
                    setStep('month');
                  }}
                >
                  {value} 年
                </button>
              ))
            : Array.from({ length: 12 }, (_, index) => index).map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-label={`${year} 年 ${value + 1} 月`}
                  aria-pressed={year === currentYear && value === currentMonth}
                  onClick={() => {
                    onSelect(addMonths(selected, (year - currentYear) * 12 + value - currentMonth));
                    onClose();
                  }}
                >
                  {value + 1} 月
                </button>
              ))}
        </fieldset>
        <p className="field-help">
          {step === 'year' ? '选好年份后，再选择月份。' : '点击月份即可跳转。'}
        </p>
      </div>
    </Sheet>
  );
}
