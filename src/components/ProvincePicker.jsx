import { useId, useState } from 'react'
import { PROVINCES, EXTRA_PLACES, OTHERS } from '../lib/provinces'

const ALL_PLACES = [...EXTRA_PLACES, ...PROVINCES]

// Province picker: one box. Type, and the list shows the places that start with what you typed
// ("B" -> Baguio City, Basilan, Bataan, ...). Pick one from the list.
// Nothing matches? "Others" shows up: pick it, then type where you're from.
//
// value = { text, choice, other }
//   text   = what's in the box
//   choice = the place picked from the list ('' = nothing picked yet, 'Others' = typed below)
//   other  = what's typed under "Others"
export default function ProvincePicker({ value, onChange, error, label = 'Where are you from?' }) {
  const [open, setOpen] = useState(false)
  const id = useId() // links the label to the box

  const typed = value.text.trim().toLowerCase()
  const matches = ALL_PLACES.filter((p) => p.toLowerCase().startsWith(typed))

  function type(text) {
    onChange({ ...value, text, choice: '' }) // typing again clears the old pick
    setOpen(true)
  }

  function pick(place) {
    if (place === OTHERS) onChange({ ...value, choice: OTHERS, other: value.other || value.text })
    else onChange({ ...value, text: place, choice: place })
    setOpen(false)
  }

  // Leaving the box: close the list. If what's typed is exactly a place, pick it.
  function leave(e) {
    if (e.currentTarget.contains(e.relatedTarget)) return // moved into the list, keep it open
    setOpen(false)
    const exact = ALL_PLACES.find((p) => p.toLowerCase() === typed)
    if (exact && value.choice !== exact) onChange({ ...value, text: exact, choice: exact })
  }

  // Pressing an option shouldn't take focus away from the box first
  // (some phones close the list before the tap counts)
  function keepFocus(event) {
    event.preventDefault()
  }

  // Enter picks the first match (or Others), instead of sending the form
  function keyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      pick(matches.length > 0 ? matches[0] : OTHERS)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="province" onBlur={leave}>
      <label htmlFor={id}>{label} <span className="hint">(optional)</span></label>
      <div className="province-box">
        <input
          id={id}
          value={value.text}
          onChange={(e) => type(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={keyDown}
          placeholder="Type a province or city"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />

        {open && (
        <ul className="province-list" role="listbox">
          {matches.map((p) => (
            <li key={p}>
              <button type="button" role="option" aria-selected={value.choice === p} onMouseDown={keepFocus} onClick={() => pick(p)}>{p}</button>
            </li>
          ))}
          {matches.length === 0 && (
            <li>
              <button type="button" role="option" aria-selected={false} onMouseDown={keepFocus} onClick={() => pick(OTHERS)}>Others: type where you're from</button>
            </li>
          )}
        </ul>
        )}
      </div>

      {value.choice === OTHERS && (
        <label>
          Where are you from?
          <input value={value.other} onChange={(e) => onChange({ ...value, other: e.target.value })} maxLength={60} placeholder="e.g. Japan" />
        </label>
      )}

      {error && <span className="field-error">{error}</span>}
    </div>
  )
}

// An empty picker
export const EMPTY_PROVINCE = { text: '', choice: '', other: '' }

// What gets saved in the booking: the picked place, or the typed one under "Others".
export function provinceToSave(value) {
  if (value.choice === OTHERS) return value.other.trim() || null
  return value.choice || null
}

// Typed something but didn't pick from the list? Returns the message to show, or '' if fine.
export function provinceError(value) {
  if (value.text.trim() !== '' && value.choice === '') return 'Pick a place from the list, or choose Others.'
  if (value.choice === OTHERS && value.other.trim() === '') return 'Type where you\'re from.'
  return ''
}
