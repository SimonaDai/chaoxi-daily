import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type CSSProperties, useMemo, useRef, useState } from 'react';
import { calendarDay, occurrencesOn } from '../domain/calendar';
import {
  addDays,
  addMonths,
  isDateKey,
  monthDays,
  parseDate,
  todayKey,
  weekdays,
} from '../domain/dates';
import { type HolidayFeed, holidayOn } from '../domain/holidays';
import type { EventRecord } from '../domain/model';
import { useCalendarGesture } from '../hooks/useCalendarGesture';
import { MonthPicker } from './MonthPicker';

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
  const grid = useRef<HTMLDivElement>(null);
  const [picker, setPicker] = useState<'year' | 'month' | null>(null);
  const month = selected.slice(0, 7);
  const dates = useMemo(() => monthDays(`${month}-01`), [month]);
  const today = todayKey();
  // 拖动只更新行高和位移，避免每一帧重复计算农历、假期和事项数量。
  const details = useMemo(
    () =>
      new Map(
        dates.filter(isDateKey).map((date) => [
          date,
          {
            day: parseDate(date),
            ...calendarDay(date, policies),
            count: occurrencesOn(events, date, category).length,
          },
        ]),
      ),
    [dates, policies, events, category],
  );
  const rows = Array.from({ length: dates.length / 7 }, (_, i) => dates.slice(i * 7, i * 7 + 7));
  const selectedRow = rows.findIndex((row) => row.includes(selected));
  const move = (direction: number) => {
    const next =
      mode === 'week' ? addDays(selected, 7 * direction) : addMonths(selected, direction);
    if (!isDateKey(next)) return;
    onSelect(next);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      grid.current?.animate(
        [
          { transform: `translateX(${direction * 35}px)`, opacity: 0.4 },
          { transform: 'translateX(0)', opacity: 1 },
        ],
        { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
    }
  };
  const gesture = useCalendarGesture({
    expanded: mode !== 'week',
    getTravel: () =>
      (rows.length - 1) *
      (grid.current?.querySelector('.day')?.getBoundingClientRect().height ?? 70),
    onExpand: (expanded) => onMode(expanded ? 'month' : 'week'),
    onPage: move,
  });
  return (
    <section className="calendar-section" aria-label="日历">
      <div className="calendar-heading">
        <div>
          <div className="eyebrow">YOUR DAYS, AT A GLANCE</div>
          <h1>
            <button
              type="button"
              className="year calendar-date-trigger"
              aria-label={`选择年份，当前 ${selectedDate.getUTCFullYear()} 年`}
              aria-haspopup="dialog"
              onClick={() => setPicker('year')}
            >
              {selectedDate.getUTCFullYear()}
            </button>{' '}
            <button
              type="button"
              className="calendar-date-trigger"
              aria-label={`选择月份，当前 ${selectedDate.getUTCMonth() + 1} 月`}
              aria-haspopup="dialog"
              onClick={() => setPicker('month')}
            >
              {selectedDate.getUTCMonth() + 1} 月
            </button>
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
          <div
            className={`calendar-gesture ${gesture.dragging ? 'is-dragging' : ''}`}
            ref={grid}
            {...gesture.handlers}
            style={
              {
                '--calendar-progress': gesture.progress,
                transform: `translateX(${gesture.offset}px)`,
              } as CSSProperties
            }
          >
            {rows.map((row, index) => (
              <div
                key={row[0]}
                className={`calendar-week ${index === selectedRow ? 'selected-week' : ''}`}
                inert={index !== selectedRow && gesture.progress === 0}
              >
                <div className="calendar-grid">
                  {row.map((date) => {
                    const detail = details.get(date);
                    if (!detail) return <span key={date} />;
                    const { day, lunar, holiday, labels, count } = detail;
                    const primary = labels[0];
                    const extra = labels
                      .slice(1)
                      .filter((label) => label.kind !== 'holiday')
                      .map((label) => label.name)
                      .join(' · ');
                    return (
                      <button
                        type="button"
                        key={date}
                        className={`day ${date === today ? 'today' : ''} ${day.getUTCMonth() !== selectedDate.getUTCMonth() ? 'outside' : ''}`}
                        aria-pressed={date === selected}
                        aria-label={`${date} 星期${weekdays[day.getUTCDay()]}，农历${lunar.full}${labels.length ? `，${labels.map((label) => label.name).join('，')}` : ''}${holiday.kind ? `，${holiday.name}，${holiday.kind === 'off' ? '放假' : '调休上班'}` : ''}，${count} 项事项`}
                        title={[
                          `农历${lunar.full}`,
                          ...labels.map((label) => label.name),
                          holiday.kind
                            ? `${holiday.name} · ${holiday.kind === 'off' ? '放假' : '补班'}`
                            : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                        onClick={() => onSelect(date)}
                      >
                        <span className="day-number">{day.getUTCDate()}</span>
                        <span className="day-labels">
                          <span className={`lunar ${primary?.kind ?? ''}`}>
                            {primary?.name ?? lunar.short}
                          </span>
                          {extra && <span className="day-extra-label">{extra}</span>}
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
              </div>
            ))}
          </div>
          <button
            type="button"
            className="calendar-grip"
            aria-label={mode === 'week' ? '展开月历' : '收起为周历'}
            aria-expanded={mode !== 'week'}
            onClick={() => onMode(mode === 'week' ? 'month' : 'week')}
          >
            <span />
          </button>
        </>
      )}
      {!holidayOn(policies, selected).configured && (
        <p className="calendar-footnote">{selectedDate.getUTCFullYear()} 年假期数据待更新</p>
      )}
      {picker && (
        <MonthPicker
          selected={selected}
          initialStep={picker}
          onSelect={onSelect}
          onClose={() => setPicker(null)}
        />
      )}
    </section>
  );
}
