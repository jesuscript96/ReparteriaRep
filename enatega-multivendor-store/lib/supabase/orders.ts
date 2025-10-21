import { supabase } from './client'

/**
 * Obtener órdenes del restaurante
 */
export async function getRestaurantOrders(
  restaurantId: string,
  status?: string
) {
  let query = supabase
    .from('orders')
    .select(
      `
      *,
      user:users!orders_user_id_fkey(id, name, phone, email),
      items:order_items(
        *,
        food:foods(title, image),
        variation:variations(title, price),
        addons:order_item_addons(*)
      ),
      rider:users!orders_rider_id_fkey(id, name, phone)
    `
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('order_status', status)
  }

  const { data, error } = await query

  if (error) throw error
  return data
}

/**
 * Obtener órdenes activas (PENDING, ACCEPTED, ASSIGNED, PICKED)
 */
export async function getActiveOrders(restaurantId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(
      `
      *,
      user:users!orders_user_id_fkey(id, name, phone),
      items:order_items(
        *,
        addons:order_item_addons(*)
      ),
      rider:users!orders_rider_id_fkey(id, name, phone)
    `
    )
    .eq('restaurant_id', restaurantId)
    .in('order_status', ['PENDING', 'ACCEPTED', 'ASSIGNED', 'PICKED'])
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * Aceptar orden
 */
export async function acceptOrder(orderId: string, preparationTime?: number) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      order_status: 'ACCEPTED',
      preparation_time: preparationTime,
    })
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw error

  // Crear notificación para el cliente
  const { data: order } = await supabase
    .from('orders')
    .select('user_id, order_id')
    .eq('id', orderId)
    .single()

  if (order) {
    await supabase.from('notifications').insert({
      user_id: order.user_id,
      title: 'Orden Aceptada',
      body: `Tu orden ${order.order_id} ha sido aceptada y está en preparación`,
      type: 'order',
      metadata: { order_id: orderId },
    })
  }

  return data
}

/**
 * Rechazar/Cancelar orden
 */
export async function rejectOrder(orderId: string, reason: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      order_status: 'CANCELLED',
      reason,
    })
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw error

  // Notificar al cliente
  const { data: order } = await supabase
    .from('orders')
    .select('user_id, order_id')
    .eq('id', orderId)
    .single()

  if (order) {
    await supabase.from('notifications').insert({
      user_id: order.user_id,
      title: 'Orden Cancelada',
      body: `Tu orden ${order.order_id} ha sido cancelada. Razón: ${reason}`,
      type: 'order',
      metadata: { order_id: orderId },
    })
  }

  return data
}

/**
 * Marcar orden como lista para recoger
 */
export async function markOrderReady(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({
      order_status: 'ASSIGNED', // Listo para asignar a rider
    })
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Suscribirse a nuevas órdenes en tiempo real
 */
export function subscribeToNewOrders(
  restaurantId: string,
  callback: (order: any) => void
) {
  const channel = supabase
    .channel(`restaurant-orders-${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      async (payload) => {
        // Obtener orden completa con relaciones
        const { data } = await supabase
          .from('orders')
          .select(
            `
            *,
            user:users!orders_user_id_fkey(id, name, phone),
            items:order_items(
              *,
              addons:order_item_addons(*)
            )
          `
          )
          .eq('id', payload.new.id)
          .single()

        if (data) callback(data)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Suscribirse a cambios en órdenes
 */
export function subscribeToOrderUpdates(
  restaurantId: string,
  callback: (order: any) => void
) {
  const channel = supabase
    .channel(`restaurant-order-updates-${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
