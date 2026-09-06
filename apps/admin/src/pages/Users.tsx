import { useNavigate } from 'react-router-dom';
import type { PlatformUser } from '@m-ensemble/shared';
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
  type Column,
} from '@/ui';
import { count, date, relative } from '@/lib/format';

/**
 * Everyone with an account — members, coordinators and platform staff in one
 * table, because "which of these is this person" is exactly the question
 * somebody arrives here with.
 *
 * The mosque column shows where they hold a role, not what they follow.
 * Following is public and says nothing about permissions; a role is the thing
 * worth seeing on a row.
 */

const columns: Column<PlatformUser>[] = [
  {
    key: 'name',
    header: 'Person',
    sortable: true,
    render: (row) => (
      <>
        <div className="cell-main">{row.name}</div>
        <div className="cell-sub">{row.email}</div>
      </>
    ),
  },
  {
    key: 'platformRole',
    header: 'Platform',
    render: (row) =>
      row.platformRole === 'superadmin' ? (
        <Badge tone="critical">Super admin</Badge>
      ) : row.platformRole === 'support' ? (
        <Badge tone="brand">Support</Badge>
      ) : (
        <span className="muted">—</span>
      ),
  },
  {
    key: 'memberships',
    header: 'Mosques',
    render: (row) => {
      const admin = row.memberships.filter((m) => m.role === 'admin');
      if (!row.memberships.length) return <span className="muted">None</span>;
      return (
        <>
          {admin.length > 0 && (
            <div>
              <Badge tone="good">Coordinator</Badge>{' '}
              <span className="cell-sub">{admin.map((m) => m.mosqueName).join(', ')}</span>
            </div>
          )}
          {admin.length === 0 && (
            <span className="cell-sub">{row.memberships.map((m) => m.mosqueName).join(', ')}</span>
          )}
        </>
      );
    },
  },
  {
    key: 'signupCount',
    header: 'Signups',
    align: 'right',
    render: (row) => count(row.signupCount),
  },
  {
    key: 'followCount',
    header: 'Follows',
    align: 'right',
    render: (row) => count(row.followCount),
  },
  {
    key: 'createdAt',
    header: 'Joined',
    sortable: true,
    render: (row) => date(row.createdAt),
  },
  {
    key: 'lastLoginAt',
    header: 'Last seen',
    sortable: true,
    render: (row) => <span className="muted">{relative(row.lastLoginAt)}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) =>
      row.status === 'suspended' ? (
        <Badge tone="critical">Suspended</Badge>
      ) : (
        <Badge tone="good">Active</Badge>
      ),
  },
];

export function Users(): React.JSX.Element {
  const navigate = useNavigate();
  const list = useListState({ platformRole: '', status: '' }, 'createdAt');
  const state = useAsync(() => api.users(list.query), [JSON.stringify(list.query)]);

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Every account on the platform. Suspend, reinstate, reset a password, or grant a role."
      />

      <Card padded={false}>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Search by name or email"
            value={list.q}
            onChange={(event) => list.setQ(event.target.value)}
          />
          <FilterSelect
            label="Platform role"
            value={list.filters.platformRole}
            onChange={(value) => list.setFilter('platformRole', value)}
            options={[
              { value: 'superadmin', label: 'Super admin' },
              { value: 'support', label: 'Support' },
              { value: 'none', label: 'No platform role' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={list.filters.status}
            onChange={(value) => list.setFilter('status', value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
        </div>

        <Async state={state}>
          {(result) => (
            <>
              <DataTable
                columns={columns}
                rows={result.items}
                sort={list.sort}
                dir={list.dir}
                onSort={list.toggleSort}
                onRowClick={(row) => navigate(`/users/${row._id}`)}
                empty="Nobody matches those filters."
              />
              <Pager page={list.page} result={result} onPage={list.setPage} />
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
