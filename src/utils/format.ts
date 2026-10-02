export function formatPrice(value: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value) || 0)} ₽`
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((todayOnly.getTime() - dateOnly.getTime()) / 86_400_000)
  const time = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  if (days === 0 || days === 1) {
    const relative = new Intl.RelativeTimeFormat('ru-RU', { numeric: 'auto' }).format(-days, 'day')
    return `${relative.charAt(0).toLocaleUpperCase('ru-RU')}${relative.slice(1)}, ${time}`
  }
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date)
}

export function shortTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  return date.toDateString() === now.toDateString()
    ? new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
    : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}
