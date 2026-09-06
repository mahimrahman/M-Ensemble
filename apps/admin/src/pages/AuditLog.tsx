import { Link } from 'react-router-dom';
import type { AuditEntry } from '@m-ensemble/shared';
import { api } from '@/api';
import {
  Async,
  Badge,
  Card,
  DataTable,
  FilterSelect,
  PageHeader,
  Pager,
  useAsync,
  useListState,
} from '@/ui';
import { dateTime, humanise, relative } from '@/lib/format';

/**
 * Everything a platform operator has done, newest first.
 *
 * Readable by `support` as well as super admins, on purpose: a log that only the
 * people it records can read is not much of a check on them. There is no way to
 * edit or delete a row from here, and no endpoint that would allow it — the
 * service exposes `record` and a read, and nothing else.
 */

/** Where a target lives, so a row is one click from the thing it happened to. */
const LINK: Record<string, (id: string) => string> = {
  mosque: (id) => `/mosques/${id}`,
  user: (id) => `/users/${id}`,
  invoice: (id) => `/billing/invoices/${id}`,
  campaign: (id) => `/campaigns/${id}`,
  ticket: (id) => `/support/${id}`,
  advertiser: () => '/partners',
  subscription: () => '/billing',
  donation: () => '/billing',
  post: () => '/events',
};

/** Actions that move money or access. Called out so they are scannable. */
const SENSITIVE =
  /^(invoice\.voided|invoice\.payment_recorded|user\.(suspended|platform_role_changed|password_reset)|mosque\.coordinator_(created|added))/;

export function AuditLog(): React.JSX.Element {
  const list = useListState({ targetType: '' }, 'createdAt');
  const state = useAsync(() => api.audit(list.query), [JSON.stringify(list.query)]);

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change a platform operator has made. Append-only — nothing here can be edited or removed."
      />

      <Card padded={false}>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search the summary, action or person"
            value={list.q}
            onChange={(event) => list.setQ(event.target.value)}
          />
          <FilterSelect
            label="Target"
            value={list.filters.targetType}
            onChange={(value) => list.setFilter('targetType', value)}
            options={[
              'mosque',
              'user',
              'invoice',
              'subscription',
              'campaign',
              'advertiser',
              'ticket',
              'donation',
              'post',
            ].map((type) => ({ value: type, label: humanise(type) }))}
          />
        </div>

        <Async state={state}>
          {(result) => (
            <>
              <DataTable<AuditEntry>
                columns={[
                  {
                    key: 'createdAt',
                    header: 'When',
                    sortable: true,
                    render: (row) => (
                      <>
                        <div>{relative(row.createdAt)}</div>
                        <div className="cell-sub">{dateTime(row.createdAt)}</div>
                      </>
                    ),
                  },
                  {
                    key: 'actorName',
                    header: 'Who',
                    sortable: true,
                    render: (row) => (
                      <Link to={`/users/${row.actorId}`} className="cell-main">
                        {row.actorName}
                      </Link>
                    ),
                  },
                  {
                    key: 'action',
                    header: 'Action',
                    sortable: true,
                    render: (row) =>
                      SENSITIVE.test(row.action) ? (
                        <Badge tone="warning">{row.action}</Badge>
                      ) : (
                        <span className="mono">{row.action}</span>
                      ),
                  },
                  {
                    key: 'summary',
                    header: 'What happened',
                    render: (row) => row.summary,
                  },
                  {
                    key: 'target',
                    header: '',
                    align: 'right',
                    render: (row) => {
                      const href = LINK[row.targetType]?.(row.targetId);
                      return href ? (
                        <Link className="btn sm" to={href}>
                          Open
                        </Link>
                      ) : null;
                    },
                  },
                ]}
                rows={result.items}
                sort={list.sort}
                dir={list.dir}
                onSort={list.toggleSort}
                empty="Nothing recorded yet."
              />
              <Pager page={list.page} result={result} onPage={list.setPage} />
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
