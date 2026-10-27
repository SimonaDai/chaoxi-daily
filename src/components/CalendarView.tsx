import { ChevronLeft, ChevronRight } from 'lucide-react';
import { chineseDate, occurrencesOn } from '../domain/calendar';
import {
  addDays,
  addMonths,
  isDateKey,
  monthDays,
  parseDate,
  todayKey,
  weekdays,
  weekStart,
} from '../domain/dates';
import { type HolidayFeed, holidayOn } from '../domain/holidays';
import type { EventRecord } from '../domain/model';

export type CalendarMode = 'week' | 'month' | 'list';

interface Props {
  selected: string;
  mode: CalendarMode;
  events: EventRecord[];
  category: string;
  policies: HolidayFeed;
  onSelect(date: string): void;
  onMode(mode: CalendarMode): void;
}

export function CalendarView({
  selected,
  mode,
  events,
  category,
  policies,
  onSelect,
  onMode,
}: Props) {
  const selectedDate = parseDate(selected);
  const dates =
    mode === 'week'
      ? Array.from({ length: 7 }, (_, i) => addDays(weekStart(selected), i))
      : monthDays(selected);
  const move = (direction: number) => {
    const next =
      mode === 'week' ? addDays(selected, 7 * direction) : addMonths(selected, direction);
    if (next >= '1900-01-01' && next <= '2100-12-31') onSelect(next);
  };
  return (
    <section className="calendar-section" aria-label="日历">
      <div className="calendar-heading">
        <div>
          <div className="eyebrow">YOUR DAYS, AT A GLANCE</div>
          <h1>
            <span className="year">{selectedDate.getUTCFullYear()}</span>{' '}
            {selectedDate.getUTCMonth() + 1} 月
          </h1>
        </div>
        <div className="month-nav">
          <button
            type="button"
            className="icon-button"
            aria-label={mode === 'week' ? '上一周' : '上个月'}
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </button>
          <button type="button" className="quiet-button" onClick={() => onSelect(todayKey())}>
            今天
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={mode === 'week' ? '下一周' : '下个月'}
            onClick={() => move(1)}
          >
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="calendar-toolbar">
        <span className="calendar-description">给重要的事留个位置。</span>
        <fieldset className="segmented" aria-label="日历视图">
          {(['week', 'month', 'list'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              onClick={() => onMode(value)}
            >
              {{ week: '周', month: '月', list: '清单' }[value]}
            </button>
          ))}
        </fieldset>
      </div>
      {mode !== 'list' && (
        <>
          <div className="weekdays" aria-hidden="true">
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={`calendar-grid ${mode === 'month' ? 'month-grid' : ''}`}>
            {dates.filter(isDateKey).map((date) => {
              const day = parseDate(date),
                lunar = chineseDate(date),
                holiday = holidayOn(policies, date),
                count = occurrencesOn(events, date, category).length;
              return (
                <button
                  type="button"
                  key={date}
                  className={`day ${date === todayKey() ? 'today' : ''} ${day.getUTCMonth() !== selectedDate.getUTCMonth() ? 'outside' : ''}`}
                  aria-pressed={date === selected}
                  aria-label={`${date} 星期${weekdays[day.getUTCDay()]}，农历${lunar.full}${lunar.term ? `，${lunar.term}` : ''}${holiday.kind ? `，${holiday.kind === 'off' ? '放假' : '调休上班'}` : ''}，${count} 项事项`}
                  onClick={() => onSelect(date)}
                >
                  <span className="day-number">{day.getUTCDate()}</span>
                  <span className={`lunar ${lunar.term ? 'term' : ''}`}>
                    {lunar.term || lunar.festival.split(' · ')[0] || lunar.short}
                  </span>
                  <span className="day-dots" aria-hidden="true">
                    {count ? '•'.repeat(Math.min(count, 3)) : ''}
                  </span>
                  {holiday.kind && (
                    <span className={`holiday-mark ${holiday.kind}`}>
                      {holiday.kind === 'off' ? '休' : '班'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
      {!holidayOn(policies, selected).configured && (
        <p className="calendar-footnote">{selectedDate.getUTCFullYear()} 年假期数据待更新</p>
      )}
    </section>
  );
}
