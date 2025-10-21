import { supabase } from './client'

/**
 * Login del Vendor
 */
export async function signInVendor(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error

  // Verificar que el usuario sea un vendor
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('user_type_id')
    .eq('id', data.user.id)
    .single()

  if (userError) throw userError

  if (userData.user_type_id !== 'vendor') {
    await supabase.auth.signOut()
    throw new Error('Este usuario no es un vendor')
  }

  return data
}

/**
 * Logout
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Obtener perfil del vendor con sus restaurantes
 */
export async function getVendorProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No user logged in')

  // Obtener datos del usuario
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (userError) throw userError

  // Obtener restaurantes del vendor
  const { data: restaurants, error: restError } = await supabase
    .from('restaurants')
    .select('*')
    .eq('vendor_id', user.id)

  if (restError) throw restError

  return {
    user: userData,
    restaurants,
  }
}
