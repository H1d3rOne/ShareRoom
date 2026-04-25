const USER_PROFILE_STORAGE_KEY = 'shareroom-user-profile'

function svgToDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function createAvatarSvg({
  key,
  from,
  to,
  skin,
  hair,
  shirt,
  accent,
  accessory = ''
}) {
  return svgToDataUri(`
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg-${key}" x1="14" y1="12" x2="110" y2="112" gradientUnits="userSpaceOnUse">
          <stop stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="34" fill="url(#bg-${key})"/>
      <circle cx="96" cy="24" r="14" fill="${accent}" fill-opacity="0.22"/>
      <circle cx="26" cy="96" r="18" fill="#FFFFFF" fill-opacity="0.12"/>
      <path d="M18 120C24 90.6 41.2 78 60 78C78.8 78 96 90.6 102 120H18Z" fill="${shirt}"/>
      <path d="M45 75C47.6 69.2 53.1 65 60 65C66.9 65 72.4 69.2 75 75H45Z" fill="${skin}" fill-opacity="0.86"/>
      <circle cx="60" cy="49" r="22" fill="${skin}"/>
      <path d="M39 48.8C39 34.3 48.5 24 61.9 24C74.6 24 82.6 31.1 84.8 43.8C80.2 42.1 74.7 39.1 69.7 34.8C62.1 40.8 49.6 44.2 39 48.8Z" fill="${hair}"/>
      <path d="M43.4 63.2C47.8 69.3 53.2 72.2 60 72.2C66.8 72.2 72.2 69.3 76.6 63.2" stroke="#7C4A34" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="52" cy="52" r="2.8" fill="#1F2937"/>
      <circle cx="68" cy="52" r="2.8" fill="#1F2937"/>
      ${accessory}
    </svg>
  `.trim())
}

export const AVATAR_PRESETS = [
  {
    id: 'coral',
    name: '珊瑚',
    src: createAvatarSvg({
      key: 'coral',
      from: '#FDBA74',
      to: '#FB7185',
      skin: '#F6D3BC',
      hair: '#3F2A2A',
      shirt: '#7C3AED',
      accent: '#FFFFFF',
      accessory: '<path d="M46 46H74" stroke="#FFFFFF" stroke-opacity="0.46" stroke-width="3" stroke-linecap="round"/>'
    })
  },
  {
    id: 'mint',
    name: '薄荷',
    src: createAvatarSvg({
      key: 'mint',
      from: '#34D399',
      to: '#0EA5E9',
      skin: '#F5D7C5',
      hair: '#14213D',
      shirt: '#0F766E',
      accent: '#D1FAE5',
      accessory: '<circle cx="60" cy="46" r="10" fill="#FFFFFF" fill-opacity="0.15"/>'
    })
  },
  {
    id: 'sunset',
    name: '日落',
    src: createAvatarSvg({
      key: 'sunset',
      from: '#F97316',
      to: '#DB2777',
      skin: '#F4CEB2',
      hair: '#4C1D95',
      shirt: '#BE123C',
      accent: '#FFF7ED',
      accessory: '<path d="M48 44C51 40 55 38 60 38C65 38 69 40 72 44" stroke="#FFF7ED" stroke-opacity="0.65" stroke-width="3" stroke-linecap="round"/>'
    })
  },
  {
    id: 'ocean',
    name: '深海',
    src: createAvatarSvg({
      key: 'ocean',
      from: '#38BDF8',
      to: '#1D4ED8',
      skin: '#F2CCB7',
      hair: '#172554',
      shirt: '#0F172A',
      accent: '#DBEAFE',
      accessory: '<rect x="45" y="46" width="30" height="15" rx="7.5" fill="#DBEAFE" fill-opacity="0.18"/>'
    })
  },
  {
    id: 'lime',
    name: '青柠',
    src: createAvatarSvg({
      key: 'lime',
      from: '#A3E635',
      to: '#14B8A6',
      skin: '#F5D8C8',
      hair: '#365314',
      shirt: '#166534',
      accent: '#ECFCCB',
      accessory: '<path d="M45 59C50 63 54.6 65 60 65C65.4 65 70 63 75 59" stroke="#FFFFFF" stroke-opacity="0.28" stroke-width="2.8" stroke-linecap="round"/>'
    })
  },
  {
    id: 'violet',
    name: '紫晶',
    src: createAvatarSvg({
      key: 'violet',
      from: '#A78BFA',
      to: '#4338CA',
      skin: '#F4D2BD',
      hair: '#312E81',
      shirt: '#6D28D9',
      accent: '#EDE9FE',
      accessory: '<circle cx="43" cy="43" r="6" fill="#EDE9FE" fill-opacity="0.24"/><circle cx="77" cy="43" r="6" fill="#EDE9FE" fill-opacity="0.24"/>'
    })
  },
  {
    id: 'amber',
    name: '琥珀',
    src: createAvatarSvg({
      key: 'amber',
      from: '#FBBF24',
      to: '#F97316',
      skin: '#F6D6C2',
      hair: '#78350F',
      shirt: '#7C2D12',
      accent: '#FEF3C7',
      accessory: '<path d="M42 47C47 42 53 40 60 40C67 40 73 42 78 47" stroke="#FEF3C7" stroke-opacity="0.52" stroke-width="3" stroke-linecap="round"/>'
    })
  },
  {
    id: 'rose',
    name: '玫瑰',
    src: createAvatarSvg({
      key: 'rose',
      from: '#FDA4AF',
      to: '#8B5CF6',
      skin: '#F4D0C1',
      hair: '#4C1D95',
      shirt: '#9D174D',
      accent: '#FDF2F8',
      accessory: '<rect x="40" y="43" width="40" height="18" rx="9" fill="#FDF2F8" fill-opacity="0.14"/>'
    })
  }
]

export const DEFAULT_AVATAR_ID = AVATAR_PRESETS[0].id

export function getAvatarPresetById(avatarId) {
  return AVATAR_PRESETS.find((item) => item.id === avatarId) || AVATAR_PRESETS[0]
}

export function resolveAvatarId(avatarId) {
  return getAvatarPresetById(avatarId).id
}

export function getRandomAvatarId() {
  return AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)].id
}

export function createRandomDisplayName() {
  return `用户${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function normalizeDisplayName(name) {
  const trimmed = `${name || ''}`.trim().slice(0, 20)
  return trimmed || createRandomDisplayName()
}

export function getStoredUserProfile() {
  if (typeof window === 'undefined') {
    return {
      displayName: createRandomDisplayName(),
      avatarId: DEFAULT_AVATAR_ID
    }
  }

  try {
    const raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    return {
      displayName: normalizeDisplayName(parsed.displayName),
      avatarId: resolveAvatarId(parsed.avatarId)
    }
  } catch (error) {
    return null
  }
}

export function saveStoredUserProfile(profile = {}) {
  const nextProfile = {
    displayName: normalizeDisplayName(profile.displayName),
    avatarId: resolveAvatarId(profile.avatarId || getRandomAvatarId())
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile))
  }

  return nextProfile
}

export function ensureStoredUserProfile() {
  const existing = getStoredUserProfile()
  if (existing) {
    return existing
  }

  return saveStoredUserProfile({
    displayName: createRandomDisplayName(),
    avatarId: getRandomAvatarId()
  })
}
