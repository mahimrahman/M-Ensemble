import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Async, Badge, Card, PageHeader, useAsync, type Tone } from '@/ui';
import { LineChart, RampBars, StatTile, type Series } from '@/ui/charts';
import { count, dateTime, money, moneyShort, percent, priceLabel, relative } from '@/lib/format';

/**
 * The platform at a glance.
 *
 * Ordered by what someone opening this at 9am actually needs: what needs a
 * human first (alerts), then the shape of the month (tiles and the activity
 * chart), then who is doing the work (the mosque leaderboard).
 *
 * The four tiles across the top are stat tiles, not charts. Four numbers with a
 * direction each is a KPI row; drawing them as a grouped bar chart would be the
 * classic way to make four readable numbers unreadable.
 */

const ACTIVITY_SERIES: Series[] = [
  { key: 'signups', label: 'Signups', slot: 0 },
  { key: 'checkIns', label: 'Check-ins', slot: 1 },
  { key: 'posts', label: 'Posts', slot: 2 },
  { key: 'newUsers', label: 'New people', slot: 3 },
];

const ALERT_TONE: Record<string, Tone> = {
  critical: 'critical',
  warn: 'warning',
  info: 'neutral',
};

export function Overview(): React.JSX.Element {
  const state = useAsync(() => api.overview(), []);

  return (
    <>
      <PageHeader
        title="Platform overview"
        subtitle={
          state.data
            ? `Every mosque, every account, every dollar — as of ${dateTime(state.data.generatedAt)}.`
            : undefined
        }
      />

      <Async state={state}>
        {(data) => (
          <div className="stack">
            {data.alerts.length > 0 && (
              <Card title={`Needs attention (${data.alerts.length})`} padded={false}>
                <div style={{ display: 'grid' }}>
                  {data.alerts.slice(0, 6).map((alert) => (
                    <Link
                      key={alert.id}
                      to={alert.href ?? '/'}
                      className="row"
                      style={{
                        padding: '11px 16px',
                        borderBottom: '1px solid var(--line)',
                        gap: 12,
                        flexWrap: 'nowrap',
                      }}
                    >
                      <Badge tone={ALERT_TONE[alert.severity] ?? 'neutral'}>
                        {alert.severity === 'critical'
                          ? 'Urgent'
                          : alert.severity === 'warn'
                            ? 'Warning'
                            : 'Note'}
                      </Badge>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="cell-main">{alert.title}</span>
                        <br />
                        <span className="cell-sub">{alert.detail}</span>
                      </span>
                      <span className="muted">→</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            <div className="grid cols-4">
              <StatTile
                label="People on the platform"
                value={count(data.users.value)}
                delta={data.users.changePct}
                deltaLabel="vs 30 days ago"
                spark={data.daily.map((d) => d.newUsers)}
              />
              <StatTile
                label="Mosques"
                value={count(data.mosques.value)}
                delta={data.mosques.changePct}
                deltaLabel={`${data.activeMosques.value} active this month`}
              />
              <StatTile
                label="Signups"
                value={count(data.signups.value)}
                delta={data.signups.changePct}
                deltaLabel="vs 30 days ago"
                spark={data.daily.map((d) => d.signups)}
              />
              <StatTile
                label="Attendance, last 30 days"
                value={percent(data.attendanceRate30d)}
                deltaLabel="checked in ÷ confirmed"
              />
            </div>

            <div className="grid cols-4">
              <StatTile
                label="Monthly recurring revenue"
                value={money(data.mrrCents)}
                deltaLabel="active subscriptions"
              />
              <StatTile
                label="Outstanding"
                value={money(data.outstandingCents)}
                deltaLabel="invoiced, not yet paid"
                tone="down-good"
              />
              <StatTile
                label="Collected, last 30 days"
                value={money(data.collected30dCents)}
                deltaLabel="payments recorded"
              />
              <StatTile
                label="Live campaigns"
                value={count(data.campaignsLive)}
                deltaLabel={`${data.ticketsOpen} open tickets`}
              />
            </div>

            <div className="grid split">
              <Card title="Activity, last 30 days">
                <LineChart points={dailyPoints(data.daily)} series={ACTIVITY_SERIES} />
              </Card>

              <Card title="Busiest mosques">
                {data.topMosques.length ? (
                  <RampBars
                    ordered={false}
                    rows={data.topMosques.map((m) => ({
                      label: m.name,
                      value: m.signupCount,
                      caption: `${m.followerCount} followers`,
                    }))}
                  />
                ) : (
                  <p className="muted">No mosque has any signups yet.</p>
                )}
              </Card>
            </div>

            <Card title="Operated mosques" padded={false}>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Mosque</th>
                      <th>Billing</th>
                      <th className="num">Followers</th>
                      <th className="num">Live posts</th>
                      <th className="num">Attendance</th>
                      <th className="num">Owing</th>
                      <th>Last activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topMosques.map((mosque) => (
                      <tr key={mosque.mosqueId}>
                        <td>
                          <Link to={`/mosques/${mosque.mosqueId}`} className="cell-main">
                            {mosque.name}
                          </Link>
                          <div className="cell-sub">{mosque.city}</div>
                        </td>
                        <td>
                          <Badge tone={mosque.priceCents === 0 ? 'neutral' : 'brand'}>
                            {priceLabel(mosque.priceCents)}
                          </Badge>
                        </td>
                        <td className="num">{count(mosque.followerCount)}</td>
                        <td className="num">{count(mosque.livePostCount)}</td>
                        <td className="num">{percent(mosque.attendanceRate)}</td>
                        <td className="num">
                          {mosque.outstandingCents > 0 ? (
                            <strong>{moneyShort(mosque.outstandingCents)}</strong>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="muted">{relative(mosque.lastActivityAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </Async>
    </>
  );
}

/** The API's daily rows, shaped for the chart's `values` bag. */
function dailyPoints(
  daily: { date: string; signups: number; posts: number; newUsers: number; checkIns: number }[],
) {
  return daily.map((day) => ({
    label: new Date(`${day.date}T12:00:00`).toLocaleDateString('en-CA', {
      day: 'numeric',
      month: 'short',
    }),
    values: {
      signups: day.signups,
      checkIns: day.checkIns,
      posts: day.posts,
      newUsers: day.newUsers,
    },
  }));
}
