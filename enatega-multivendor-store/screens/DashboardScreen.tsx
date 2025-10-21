import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native'
import {
  getVendorProfile,
  getActiveOrders,
  acceptOrder,
  rejectOrder,
  subscribeToNewOrders,
  subscribeToOrderUpdates,
  signOut,
} from '../lib/supabase'

export default function DashboardScreen({ navigation }: any) {
  const [restaurant, setRestaurant] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (!restaurant) return

    // Cargar órdenes iniciales
    loadOrders()

    // Suscribirse a nuevas órdenes (Realtime)
    const unsubscribeNew = subscribeToNewOrders(restaurant.id, (newOrder) => {
      console.log('🔔 NUEVA ORDEN RECIBIDA!', newOrder.order_id)
      Alert.alert(
        '🔔 Nueva Orden',
        `Orden ${newOrder.order_id}\nTotal: $${newOrder.order_amount}`,
        [{ text: 'Ver', onPress: () => setSelectedOrder(newOrder) }]
      )
      setOrders((prev) => [newOrder, ...prev])
    })

    // Suscribirse a actualizaciones (Realtime)
    const unsubscribeUpdates = subscribeToOrderUpdates(restaurant.id, (updated) => {
      console.log('🔄 Orden actualizada:', updated.order_id)
      setOrders((prev) =>
        prev.map((order) => (order.id === updated.id ? { ...order, ...updated } : order))
      )
    })

    return () => {
      unsubscribeNew()
      unsubscribeUpdates()
    }
  }, [restaurant])

  const loadProfile = async () => {
    try {
      const profile = await getVendorProfile()
      console.log('✅ Perfil cargado:', profile.user.name)
      if (profile.restaurants.length > 0) {
        setRestaurant(profile.restaurants[0])
      } else {
        Alert.alert('Error', 'No tienes restaurantes asignados')
      }
    } catch (error: any) {
      console.error('❌ Error cargando perfil:', error.message)
      Alert.alert('Error', 'Error al cargar perfil')
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async () => {
    if (!restaurant) return

    try {
      const data = await getActiveOrders(restaurant.id)
      console.log(`✅ ${data.length} órdenes activas`)
      setOrders(data)
    } catch (error: any) {
      console.error('❌ Error cargando órdenes:', error.message)
    } finally {
      setRefreshing(false)
    }
  }

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await acceptOrder(orderId, 20) // 20 min de preparación
      Alert.alert('✅ Éxito', 'Orden aceptada')
      setSelectedOrder(null)
      loadOrders()
    } catch (error: any) {
      Alert.alert('❌ Error', error.message)
    }
  }

  const handleRejectOrder = async (orderId: string) => {
    Alert.alert(
      'Rechazar Orden',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejectOrder(orderId, 'No disponible')
              Alert.alert('✅ Orden rechazada')
              setSelectedOrder(null)
              loadOrders()
            } catch (error: any) {
              Alert.alert('❌ Error', error.message)
            }
          },
        },
      ]
    )
  }

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          onPress: async () => {
            await signOut()
            navigation.replace('Login')
          },
        },
      ]
    )
  }

  const getStatusColor = (status: string) => {
    const colors: any = {
      PENDING: '#FF9800',
      ACCEPTED: '#4CAF50',
      ASSIGNED: '#2196F3',
      PICKED: '#9C27B0',
      DELIVERED: '#4CAF50',
      CANCELLED: '#F44336',
    }
    return colors[status] || '#666'
  }

  const getStatusText = (status: string) => {
    const texts: any = {
      PENDING: 'Pendiente',
      ACCEPTED: 'Aceptada',
      ASSIGNED: 'Asignada',
      PICKED: 'Recogida',
      DELIVERED: 'Entregada',
      CANCELLED: 'Cancelada',
    }
    return texts[status] || status
  }

  const renderOrder = ({ item }: any) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => setSelectedOrder(item)}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>#{item.order_id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.order_status) }]}>
          <Text style={styles.statusText}>{getStatusText(item.order_status)}</Text>
        </View>
      </View>

      <Text style={styles.customerName}>👤 {item.user?.name || 'Cliente'}</Text>
      <Text style={styles.orderAmount}>💰 ${item.order_amount.toFixed(2)}</Text>

      <Text style={styles.itemsCount}>
        📦 {item.items?.length || 0} productos
      </Text>

      {item.order_status === 'PENDING' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAcceptOrder(item.id)}
          >
            <Text style={styles.actionButtonText}>✅ Aceptar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectOrder(item.id)}
          >
            <Text style={styles.actionButtonText}>❌ Rechazar</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Cargando...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🏪 {restaurant?.name || 'Mi Restaurante'}</Text>
          <Text style={styles.headerSubtitle}>{orders.length} órdenes activas</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de órdenes */}
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true)
            loadOrders()
          }} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>🎉</Text>
            <Text style={styles.emptyTitle}>No hay órdenes activas</Text>
            <Text style={styles.emptySubtitle}>Las nuevas órdenes aparecerán aquí</Text>
          </View>
        }
      />

      {/* Modal de detalle de orden */}
      {selectedOrder && (
        <Modal
          visible={!!selectedOrder}
          animationType="slide"
          transparent
          onRequestClose={() => setSelectedOrder(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Orden #{selectedOrder.order_id}</Text>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Cliente:</Text>
                <Text style={styles.modalValue}>{selectedOrder.user?.name}</Text>
                <Text style={styles.modalValue}>{selectedOrder.user?.phone}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Dirección:</Text>
                <Text style={styles.modalValue}>{selectedOrder.delivery_address_text}</Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Productos:</Text>
                {selectedOrder.items?.map((item: any, index: number) => (
                  <Text key={index} style={styles.modalItem}>
                    • {item.quantity}x {item.title}
                  </Text>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.modalLabel}>Total:</Text>
                <Text style={styles.modalTotal}>${selectedOrder.order_amount.toFixed(2)}</Text>
              </View>

              {selectedOrder.order_status === 'PENDING' && (
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.acceptButton]}
                    onPress={() => handleAcceptOrder(selectedOrder.id)}
                  >
                    <Text style={styles.modalButtonText}>✅ Aceptar Orden</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.rejectButton]}
                    onPress={() => handleRejectOrder(selectedOrder.id)}
                  >
                    <Text style={styles.modalButtonText}>❌ Rechazar</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedOrder(null)}
              >
                <Text style={styles.closeButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    color: '#F44336',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  orderAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  itemsCount: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
    color: '#333',
  },
  modalItem: {
    fontSize: 14,
    color: '#333',
    marginTop: 4,
  },
  modalTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  modalActions: {
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#666',
    fontSize: 16,
  },
})
