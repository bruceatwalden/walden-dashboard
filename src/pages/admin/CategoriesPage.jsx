import { useState, useEffect } from 'react'
import { getPhases, savePhases, DEFAULT_PHASES } from '../../lib/construction-phases'
import { getPhaseCounts } from '../../lib/queries'

export default function CategoriesPage() {
  const [phases, setPhases] = useState(() => getPhases())
  const [expandedIndex, setExpandedIndex] = useState(-1)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [counts, setCounts] = useState({})
  const [newSubInputs, setNewSubInputs] = useState({}) // index → string
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')

  useEffect(() => {
    getPhaseCounts().then(setCounts).catch(() => {})
  }, [])

  function updatePhase(index, updates) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)))
    setDirty(true)
  }

  function togglePhase(index) {
    updatePhase(index, { enabled: !phases[index].enabled })
  }

  function movePhase(index, direction) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= phases.length) return
    setPhases((prev) => {
      const next = [...prev]
      const temp = next[index]
      next[index] = next[newIndex]
      next[newIndex] = temp
      return next
    })
    setDirty(true)
    // Track expanded row if it moved
    if (expandedIndex === index) setExpandedIndex(newIndex)
    else if (expandedIndex === newIndex) setExpandedIndex(index)
  }

  function deleteSubcategory(phaseIndex, subIndex) {
    const subs = [...phases[phaseIndex].subcategories]
    subs.splice(subIndex, 1)
    updatePhase(phaseIndex, { subcategories: subs })
  }

  function addSubcategory(phaseIndex) {
    const value = (newSubInputs[phaseIndex] || '').trim()
    if (!value) return
    const subs = [...phases[phaseIndex].subcategories, value]
    updatePhase(phaseIndex, { subcategories: subs })
    setNewSubInputs((prev) => ({ ...prev, [phaseIndex]: '' }))
  }

  function addCategory() {
    const name = newCatName.trim()
    if (!name) return
    setPhases((prev) => [
      ...prev,
      { name, description: newCatDesc.trim(), subcategories: [], enabled: true },
    ])
    setNewCatName('')
    setNewCatDesc('')
    setShowAddCategory(false)
    setDirty(true)
  }

  function handleSave() {
    savePhases(phases)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    setPhases(DEFAULT_PHASES.map((p) => ({ ...p, subcategories: [...p.subcategories] })))
    setExpandedIndex(-1)
    localStorage.removeItem('construction_phases_config')
    setDirty(false)
    setSaved(false)
  }

  const enabledCount = phases.filter((p) => p.enabled).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Construction Phases</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage categories used for AI photo tagging.
          {' '}{enabledCount} of {phases.length} enabled.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {phases.map((phase, index) => {
            const isExpanded = expandedIndex === index
            const photoCount = counts[phase.name] || 0

            return (
              <div key={phase.name + index}>
                {/* Collapsed row */}
                <div
                  className={`flex items-center gap-3 px-4 py-3 ${
                    !phase.enabled ? 'opacity-50' : ''
                  }`}
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => movePhase(index, -1)}
                      disabled={index === 0}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                      </svg>
                    </button>
                    <button
                      onClick={() => movePhase(index, 1)}
                      disabled={index === phases.length - 1}
                      className="text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>

                  {/* Expand toggle + name */}
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? -1 : index)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                    <span className="text-sm font-medium text-gray-900 truncate">{phase.name}</span>
                  </button>

                  {/* Subcategory count */}
                  <span className="text-xs text-gray-400 shrink-0">
                    {phase.subcategories.length} sub{phase.subcategories.length !== 1 ? 's' : ''}
                  </span>

                  {/* Photo count */}
                  <span className="text-xs text-gray-400 tabular-nums shrink-0 w-16 text-right">
                    {photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}` : ''}
                  </span>

                  {/* Toggle */}
                  <button
                    onClick={() => togglePhase(index)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${
                      phase.enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        phase.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 ml-8 space-y-4 border-t border-gray-50">
                    {/* Description */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                      <textarea
                        value={phase.description}
                        onChange={(e) => updatePhase(index, { description: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        placeholder="Describe what this phase covers..."
                      />
                    </div>

                    {/* Subcategories */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2">
                        Subcategories ({phase.subcategories.length})
                      </label>
                      {phase.subcategories.length > 0 ? (
                        <div className="space-y-1.5 mb-3">
                          {phase.subcategories.map((sub, si) => (
                            <div key={sub + si} className="flex items-center gap-2 group">
                              <span className="text-sm text-gray-700 flex-1">{sub}</span>
                              <span className="text-xs text-gray-300 tabular-nums">
                                {counts[`${phase.name} > ${sub}`] || 0}
                              </span>
                              <button
                                onClick={() => deleteSubcategory(index, si)}
                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                title="Remove"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-300 mb-3">No subcategories yet</p>
                      )}

                      {/* Add subcategory */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newSubInputs[index] || ''}
                          onChange={(e) =>
                            setNewSubInputs((prev) => ({ ...prev, [index]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); addSubcategory(index) }
                          }}
                          placeholder="Add subcategory..."
                          className="flex-1 border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => addSubcategory(index)}
                          disabled={!(newSubInputs[index] || '').trim()}
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add category */}
      {showAddCategory ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-900">New Category</h3>
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Category name"
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            value={newCatDesc}
            onChange={(e) => setNewCatDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={addCategory}
              disabled={!newCatName.trim()}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Category
            </button>
            <button
              onClick={() => { setShowAddCategory(false); setNewCatName(''); setNewCatDesc('') }}
              className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddCategory(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Category
        </button>
      )}

      {/* Save / Reset */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Save Changes
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Reset to Defaults
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
        {dirty && !saved && <span className="text-xs text-amber-500">Unsaved changes</span>}
      </div>

      <p className="text-xs text-gray-400">
        Changes affect future photo categorization only. Existing tags are not modified.
      </p>
    </div>
  )
}
