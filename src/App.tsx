import { HardDrive, ImagePlus, Inbox, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type CalendarMode, CalendarView } from './components/CalendarView';
import { categoryStyle, EventDeck } from './components/EventDeck';
import { type EditorInput, EventEditor } from './components/EventEditor';
import { ImportNotice } from './components/ImportNotice';
import { Settings } from './components/Settings';
import { chineseDate, occurrencesBetween, occurrencesOn } from './domain/calendar';
import { addDays, parseDate, readableDate, todayKey, weekdays } from './domain/dates';
import { holidayOn } from './domain/holidays';
import type { Occurrence } from './domain/model';
import { useAppModel } from './hooks/useAppModel';

export default function App() {
  const app = useAppModel();
  const [selected, setSelected] = useState(todayKey()),
    [mode, setMode] = useState<CalendarMode>('week');
  const [category, setCategory] = useState('all'),
    [panel, setPanel] = useState<'import' | 'settings' | 'inbox' | null>(null);
  const [editor, setEditor] = useState<EditorInput | null>(null);
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(todayKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const snapshot = app.snapshot;
  if (app.error)
    return (
      <main className="startup-state">
        <h1>本机资料暂时无法打开</h1>
        <p role="alert">{app.error}</p>
        <button type="button" className="primary-button" onClick={() => window.location.reload()}>
          重新读取
        </button>
      </main>
    );
  if (!snapshot)
    return (
      <main className="startup-state" role="status">
        <span className="brand-emblem">朝</span>
        <h1>朝夕●一日一记</h1>
        <p>正在打开本机日历…</p>
      </main>
    );
  const inbox = snapshot.events.filter((event) => !event.date);
  const items = occurrencesOn(snapshot.events, selected, category),
    lunar = chineseDate(selected),
    holiday = holidayOn(app.policies, selected);
  const upcoming = occurrencesBetween(snapshot.events, addDays(selected, 1), 7, category);
  const first = `${selected.slice(0, 7)}-01`,
    last = new Date(
      Date.UTC(parseDate(selected).getUTCFullYear(), parseDate(selected).getUTCMonth() + 1, 0),
    ).getUTCDate();
  const monthItems =
    mode === 'list' ? occurrencesBetween(snapshot.events, first, last, category) : [];
  const add = () => setEditor({ selected });
  const edit = (item: Occurrence) =>
    setEditor({ selected: item.date, event: item.event, occurrence: item });
  const onDelete = (item: Occurrence, scope: 'one' | 'series') => {
    void app.removeEvent(item.event, item, scope).catch(app.report);
  };
  const itemButton = (item: Occurrence) => (
    <button
      type="button"
      className="upcoming-item"
      key={item.key}
      onClick={() => {
        setSelected(item.date);
        setMode('week');
        edit(item);
      }}
      style={categoryStyle(
        snapshot.categories.find((value) => value.id === item.fields.categoryId),
      )}
    >
      <span className="upcoming-date">
        {parseDate(item.date).getUTCDate()}
        <small>{parseDate(item.date).getUTCMonth() + 1} 月</small>
      </span>
      <span className="upcoming-text">
        <span>{item.fields.title}</span>
        <small>
          {snapshot.categories.find((value) => value.id === item.fields.categoryId)?.name} ·{' '}
          {item.fields.time || '全天'}
        </small>
      </span>
      <span className="upcoming-dot" aria-hidden="true" />
    </button>
  );

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-emblem" aria-hidden="true">
            朝
          </span>
          <div>
            <div className="brand-name">
              朝夕<span className="brand-dot">●</span>
              <span className="brand-tag">一日一记</span>
            </div>
            <p>学习、工作，也记生活。</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="icon-button inbox-button"
            aria-label={`待整理，${inbox.length} 件事项`}
            onClick={() => setPanel(panel === 'inbox' ? null : 'inbox')}
          >
            <Inbox />
            {!!inbox.length && <span>{inbox.length}</span>}
          </button>
          <button type="button" className="round-button" aria-label="快速新建事项" onClick={add}>
            <Plus />
          </button>
        </div>
      </header>
      <main className="app-main">
        <div className="calendar-column">
          <CalendarView
            selected={selected}
            mode={mode}
            events={snapshot.events}
            category={category}
            policies={app.policies}
            onSelect={setSelected}
            onMode={setMode}
          />
          <div className="filter-row">
            <label className="category-filter">
              <span className="sr-only">筛选事项类型</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">所有类型</option>
                {snapshot.categories.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="filter-legend">休＝放假 · 班＝调休上班</span>
          </div>
          <div className="desktop-categories">
            {snapshot.categories.map((value) => (
              <button
                key={value.id}
                type="button"
                style={categoryStyle(value)}
                aria-pressed={category === value.id}
                onClick={() => setCategory(category === value.id ? 'all' : value.id)}
              >
                <span className="category-dot" />
                {value.name}
              </button>
            ))}
          </div>
        </div>
        <section
          className="agenda-column"
          aria-label={panel === 'inbox' ? '待整理事项' : '当天安排'}
        >
          {panel === 'inbox' ? (
            <>
              <div className="agenda-heading">
                <div>
                  <div className="eyebrow">TAKE YOUR TIME</div>
                  <h2>待整理</h2>
                </div>
                <button type="button" className="text-button" onClick={() => setPanel(null)}>
                  返回日历
                </button>
              </div>
              <p className="agenda-sub">先把通知收下，日期可以慢慢补。</p>
              {inbox.length ? (
                <div className="inbox-list">
                  {inbox.map((event) => (
                    <button
                      type="button"
                      className="inbox-item"
                      key={event.id}
                      onClick={() => setEditor({ selected, event })}
                      style={categoryStyle(
                        snapshot.categories.find((value) => value.id === event.fields.categoryId),
                      )}
                    >
                      <span className="category-dot" />
                      <span>
                        <strong>{event.fields.title}</strong>
                        <small>
                          {
                            snapshot.categories.find(
                              (value) => value.id === event.fields.categoryId,
                            )?.name
                          }{' '}
                          · 日期待定
                        </small>
                      </span>
                      <span>↗</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h3>还没有待整理的事。</h3>
                  <p>截图没有日期时，可以先放在这里。</p>
                </div>
              )}
            </>
          ) : mode === 'list' ? (
            <>
              <div className="agenda-heading">
                <h2>{parseDate(selected).getUTCMonth() + 1} 月清单</h2>
                <span>{monthItems.length} 项</span>
              </div>
              <div className="month-list">
                {monthItems.length ? (
                  monthItems.map(itemButton)
                ) : (
                  <div className="empty-state">
                    <p>这个月还没有这类安排。</p>
                    <button type="button" className="primary-button" onClick={add}>
                      记一件事
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="agenda-heading">
                <div>
                  <div className="eyebrow">
                    {selected === today ? 'TODAY' : 'DAY NOTES'} · 星期
                    {weekdays[parseDate(selected).getUTCDay()]}
                  </div>
                  <h2>{readableDate(selected)}</h2>
                </div>
                <span>{items.length} 件事</span>
              </div>
              <p className="agenda-sub">
                农历{lunar.full}
                {lunar.term ? ` · ${lunar.term}` : ''}
                {holiday.name ? ` · ${holiday.name}` : ''}
              </p>
              <EventDeck
                key={`${selected}:${category}`}
                items={items}
                categories={snapshot.categories}
                completed={snapshot.completed}
                photos={snapshot.photos}
                repository={app.repository}
                busy={app.busy}
                onToggle={(item) => {
                  void app.toggle(item.key).catch(app.report);
                }}
                onEdit={edit}
                onDelete={onDelete}
                onAdd={add}
              />
              <details className="future-peek">
                <summary>
                  <span>接下来 7 天</span>
                  <span>{upcoming.length} 项安排</span>
                  <span aria-hidden="true">⌄</span>
                </summary>
                <div>
                  {upcoming.length ? (
                    upcoming.map(itemButton)
                  ) : (
                    <p className="field-help">未来一周暂无这类安排。</p>
                  )}
                </div>
              </details>
            </>
          )}
        </section>
      </main>
      <nav className="bottom-dock" aria-label="快速记录">
        <button type="button" onClick={() => setPanel('import')}>
          <ImagePlus />
          <span>截图记录</span>
        </button>
        <button type="button" className="dock-primary" onClick={add}>
          <Plus />
          <span>记一件事</span>
        </button>
        <button type="button" onClick={() => setPanel('settings')}>
          <HardDrive />
          <span>本机存图</span>
        </button>
      </nav>
      {app.message && (
        <div className="toast" role="status">
          <span>{app.message}</span>
          <button type="button" aria-label="关闭提示" onClick={() => app.setMessage('')}>
            <X />
          </button>
        </div>
      )}
      {editor && (
        <EventEditor
          input={editor}
          app={app}
          onClose={() => setEditor(null)}
          onSaved={(date) => {
            setEditor(null);
            if (date) {
              setSelected(date);
              setPanel(null);
            } else setPanel('inbox');
          }}
        />
      )}
      {panel === 'import' && !editor && (
        <ImportNotice
          onClose={() => setPanel(null)}
          onDraft={(draft, photo) => {
            setPanel(null);
            setEditor({ selected, draft, photo: photo ?? undefined });
          }}
        />
      )}
      {panel === 'settings' && <Settings app={app} onClose={() => setPanel(null)} />}
    </div>
  );
}
