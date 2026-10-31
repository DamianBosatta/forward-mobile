interface UsuarioIdentidad {
  roles?: string[]
  username?: string
  email?: string | null
}

/** Líneas del encabezado de Mi cuenta: el usuario no se repite si es el mismo email. */
export function lineasDeIdentidad(user: UsuarioIdentidad | null | undefined): { rol: string; email: string | null } {
  const email = user?.email || null
  const usuario = user?.username && user.username.toLowerCase() !== email?.toLowerCase() ? user.username : undefined
  const rol = [user?.roles?.join(' · '), usuario].filter(Boolean).join(' · ')
  return { rol, email }
}
