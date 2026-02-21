import { useState, useEffect, useCallback } from 'react'
import { useDashboardQuery } from '../../hooks/useDashboardQuery'
import { getProjects } from '../../lib/queries'

export default function ProjectSelector({ value, onChange }) {
  const fetchProjects = useCallback(() => getProjects(), [])
  const { data: projects, loading } = useDashboardQuery(fetchProjects, 0)

  return (
    <select
      value={value || 'all'}
      onChange={(e) => onChange(e.target.value === 'all' ? null : e.target.value)}
      disabled={loading}
      className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white
                 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="all">All Projects</option>
      {projects?.map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </select>
  )
}
