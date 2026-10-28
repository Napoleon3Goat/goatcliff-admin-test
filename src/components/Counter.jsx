// A number box with − and + buttons, easier to tap on a phone than typing.
export default function Counter({ label, hint, value, onChange, min = 0, max = 99 }) {
  const set = (n) => onChange(Math.max(min, Math.min(max, n)))
  return (
    <div className="counter">
      <div>
        <span className="counter-label">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </div>
      <div className="counter-controls">
        <button type="button" onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Fewer ${label}`}>−</button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => set(Number(e.target.value) || 0)}
          aria-label={label}
        />
        <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label={`More ${label}`}>+</button>
      </div>
    </div>
  )
}
