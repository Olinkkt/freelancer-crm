export function getShortcutSections(modKey: string) {
  return [
    {
      title: 'Global',
      items: [
        { keys: [modKey, 'K'], label: 'Open command palette' },
        { keys: ['?'], label: 'Show shortcuts' },
        { keys: ['Esc'], label: 'Close modal or palette, or go back from a deal' },
      ],
    },
    {
      title: 'Quick actions',
      items: [
        { keys: ['N'], label: 'New deal' },
        { keys: ['C'], label: 'New client' },
        { keys: [modKey, '↵'], label: 'Submit quick-add form' },
      ],
    },
    {
      title: 'Deals list',
      items: [
        { keys: ['Tab'], label: 'Focus next deal' },
        { keys: ['↵'], label: 'Open focused deal' },
      ],
    },
    {
      title: 'Go to',
      items: [
        { keys: ['G', 'H'], label: 'Home' },
        { keys: ['G', 'D'], label: 'Deals' },
        { keys: ['G', 'C'], label: 'Clients' },
        { keys: ['G', 'S'], label: 'Settings' },
      ],
    },
  ]
}
