/**
 * Domain Entities Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  Money,
  Email,
  PhoneNumber,
  Address,
  User,
  UserRole,
  Order,
  OrderStatus,
  PaymentStatus,
  Cart,
  Inventory,
} from '@/domain/entities';

describe('Money Value Object', () => {
  it('should create money with amount and currency', () => {
    const money = new Money(100, 'USD');
    expect(money.amount).toBe(100);
    expect(money.currency).toBe('USD');
  });

  it('should default to the store currency, BDT', () => {
    const money = new Money(50);
    expect(money.currency).toBe('BDT');
    expect(money.format()).toBe('৳50');
  });

  it('should throw error for negative amount', () => {
    expect(() => new Money(-10)).toThrow('Amount cannot be negative');
  });

  it('should add two money objects', () => {
    const money1 = new Money(100, 'USD');
    const money2 = new Money(50, 'USD');
    const result = money1.add(money2);
    expect(result.amount).toBe(150);
  });

  it('should throw error when adding different currencies', () => {
    const money1 = new Money(100, 'USD');
    const money2 = new Money(50, 'EUR');
    expect(() => money1.add(money2)).toThrow('Cannot add different currencies');
  });

  it('should subtract two money objects', () => {
    const money1 = new Money(100, 'USD');
    const money2 = new Money(30, 'USD');
    const result = money1.subtract(money2);
    expect(result.amount).toBe(70);
  });

  it('should multiply money by factor', () => {
    const money = new Money(100, 'USD');
    const result = money.multiply(2);
    expect(result.amount).toBe(200);
  });

  it('should format money as currency string', () => {
    const money = new Money(1234.56, 'USD');
    expect(money.format()).toBe('$1,234.56');
  });
});

describe('Email Value Object', () => {
  it('should create email with valid format', () => {
    const email = new Email('test@example.com');
    expect(email.toString()).toBe('test@example.com');
  });

  it('should lowercase email', () => {
    const email = new Email('Test@EXAMPLE.COM');
    expect(email.toString()).toBe('test@example.com');
  });

  it('should throw error for invalid email', () => {
    expect(() => new Email('invalid')).toThrow('Invalid email format');
    expect(() => new Email('invalid@')).toThrow('Invalid email format');
    expect(() => new Email('@example.com')).toThrow('Invalid email format');
  });
});

describe('PhoneNumber Value Object', () => {
  it('should create phone number with valid format', () => {
    const phone = new PhoneNumber('555-123-4567');
    expect(phone.toString()).toBe('5551234567');
  });

  it('should strip non-numeric characters', () => {
    const phone = new PhoneNumber('+1 (555) 123-4567');
    expect(phone.toString()).toBe('15551234567');
  });

  it('should format phone number', () => {
    const phone = new PhoneNumber('5551234567');
    expect(phone.format()).toBe('(555) 123-4567');
  });

  it('should throw error for too short phone number', () => {
    expect(() => new PhoneNumber('123')).toThrow('Invalid phone number');
  });

  it('should throw error for too long phone number', () => {
    expect(() => new PhoneNumber('12345678901234567890')).toThrow('Invalid phone number');
  });
});

describe('Address Value Object', () => {
  it('should create address with all fields', () => {
    const address = new Address(
      '123 Main St',
      'New York',
      'NY',
      '10001',
      'United States',
      'Apt 4B'
    );
    expect(address.street).toBe('123 Main St');
    expect(address.city).toBe('New York');
    expect(address.state).toBe('NY');
    expect(address.postalCode).toBe('10001');
    expect(address.country).toBe('United States');
    expect(address.apartment).toBe('Apt 4B');
  });

  it('should format address correctly', () => {
    const address = new Address(
      '123 Main St',
      'New York',
      'NY',
      '10001',
      'United States'
    );
    const formatted = address.format();
    expect(formatted).toContain('123 Main St');
    expect(formatted).toContain('New York, NY 10001');
    expect(formatted).toContain('United States');
  });
});

describe('User Entity', () => {
  it('should create user with factory method', () => {
    const user = User.create({
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
    });

    expect(user.email).toBe('john@example.com');
    expect(user.firstName).toBe('John');
    expect(user.lastName).toBe('Doe');
    expect(user.fullName).toBe('John Doe');
    expect(user.role).toBe(UserRole.CUSTOMER);
    expect(user.isActive).toBe(true);
    expect(user.isEmailVerified).toBe(false);
  });

  it('should identify admin users', () => {
    const admin = User.create({
      email: 'admin@example.com',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    });
    expect(admin.isAdmin()).toBe(true);

    const customer = User.create({
      email: 'customer@example.com',
      firstName: 'Customer',
      lastName: 'User',
      role: UserRole.CUSTOMER,
    });
    expect(customer.isAdmin()).toBe(false);
  });

  it('should add address to user', () => {
    const user = User.create({
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
    });

    const address = new Address('123 Main St', 'NYC', 'NY', '10001', 'USA');
    user.addAddress(address);

    expect(user.addresses.length).toBe(1);
    expect(user.addresses[0].street).toBe('123 Main St');
  });

  it('should update profile', () => {
    const user = User.create({
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
    });

    user.updateProfile({ firstName: 'Jane', lastName: 'Smith' });

    expect(user.firstName).toBe('Jane');
    expect(user.lastName).toBe('Smith');
  });

  it('should deactivate user', () => {
    const user = User.create({
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
    });

    user.deactivate();
    expect(user.isActive).toBe(false);
  });
});

describe('Cart Entity', () => {
  it('should create empty cart', () => {
    const cart = Cart.create('session-123', 'user-456');

    expect(cart.sessionId).toBe('session-123');
    expect(cart.userId).toBe('user-456');
    expect(cart.isEmpty).toBe(true);
    expect(cart.itemCount).toBe(0);
  });

  it('should add item to cart', () => {
    const cart = Cart.create('session-123');

    cart.addItem('product-1', 2);

    expect(cart.isEmpty).toBe(false);
    expect(cart.itemCount).toBe(2);
    expect(cart.items.length).toBe(1);
  });

  it('should increase quantity for existing item', () => {
    const cart = Cart.create('session-123');

    cart.addItem('product-1', 2);
    cart.addItem('product-1', 3);

    expect(cart.items.length).toBe(1);
    expect(cart.itemCount).toBe(5);
  });

  it('should handle variations separately', () => {
    const cart = Cart.create('session-123');

    cart.addItem('product-1', 2, 'variation-a');
    cart.addItem('product-1', 3, 'variation-b');

    expect(cart.items.length).toBe(2);
    expect(cart.itemCount).toBe(5);
  });

  it('should update item quantity', () => {
    const cart = Cart.create('session-123');
    cart.addItem('product-1', 2);

    const itemId = cart.items[0].id;
    cart.updateItemQuantity(itemId, 5);

    expect(cart.itemCount).toBe(5);
  });

  it('should remove item when quantity is zero', () => {
    const cart = Cart.create('session-123');
    cart.addItem('product-1', 2);

    const itemId = cart.items[0].id;
    cart.updateItemQuantity(itemId, 0);

    expect(cart.isEmpty).toBe(true);
  });

  it('should remove item by id', () => {
    const cart = Cart.create('session-123');
    cart.addItem('product-1', 2);
    cart.addItem('product-2', 3);

    const itemId = cart.items[0].id;
    cart.removeItem(itemId);

    expect(cart.items.length).toBe(1);
    expect(cart.itemCount).toBe(3);
  });

  it('should clear cart', () => {
    const cart = Cart.create('session-123');
    cart.addItem('product-1', 2);
    cart.addItem('product-2', 3);
    cart.applyCoupon('SAVE10');

    cart.clear();

    expect(cart.isEmpty).toBe(true);
    expect(cart.couponCode).toBeUndefined();
  });

  it('should apply coupon', () => {
    const cart = Cart.create('session-123');
    cart.applyCoupon('SAVE10');

    expect(cart.couponCode).toBe('SAVE10');
  });
});

describe('Inventory Entity', () => {
  it('should create inventory', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 100,
      lowStockThreshold: 10,
    });

    expect(inventory.productId).toBe('product-1');
    expect(inventory.stock).toBe(100);
    expect(inventory.availableStock).toBe(100);
  });

  it('should detect low stock', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 5,
      lowStockThreshold: 10,
    });

    expect(inventory.isLowStock()).toBe(true);
  });

  it('should detect out of stock', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 0,
      lowStockThreshold: 10,
    });

    expect(inventory.isOutOfStock()).toBe(true);
  });

  it('should check if can fulfill', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 50,
      lowStockThreshold: 10,
    });

    expect(inventory.canFulfill(30)).toBe(true);
    expect(inventory.canFulfill(60)).toBe(false);
  });

  it('should reserve stock', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 50,
      lowStockThreshold: 10,
    });

    const result = inventory.reserve(20);

    expect(result).toBe(true);
    expect(inventory.reservedStock).toBe(20);
    expect(inventory.availableStock).toBe(30);
  });

  it('should not reserve more than available', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 10,
      lowStockThreshold: 5,
    });

    const result = inventory.reserve(20);

    expect(result).toBe(false);
    expect(inventory.reservedStock).toBe(0);
  });

  it('should release reservation', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 50,
      lowStockThreshold: 10,
    });

    inventory.reserve(20);
    inventory.releaseReservation(10);

    expect(inventory.reservedStock).toBe(10);
    expect(inventory.availableStock).toBe(40);
  });

  it('should deduct for sale and create log', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 50,
      lowStockThreshold: 10,
    });

    inventory.deductForSale(10, 'order-123', 'system');

    expect(inventory.stock).toBe(40);
    expect(inventory.logs.length).toBe(1);
    expect(inventory.logs[0].type).toBe('sale');
    expect(inventory.logs[0].quantity).toBe(-10);
  });

  it('should adjust stock and create log', () => {
    const inventory = Inventory.create({
      productId: 'product-1',
      locationId: 'warehouse-1',
      sku: 'SKU-001',
      stock: 50,
      lowStockThreshold: 10,
    });

    inventory.adjustStock(25, 'Restocking', 'admin');

    expect(inventory.stock).toBe(75);
    expect(inventory.logs.length).toBe(1);
    expect(inventory.logs[0].type).toBe('adjustment');
    expect(inventory.logs[0].reason).toBe('Restocking');
  });
});

describe('Order Entity', () => {
  it('should generate unique order numbers', () => {
    const orderNumber1 = Order.generateOrderNumber();
    const orderNumber2 = Order.generateOrderNumber();

    expect(orderNumber1).toMatch(/^ORD-\d{6}-[A-Z0-9]{6}$/);
    expect(orderNumber1).not.toBe(orderNumber2);
  });

  it('should determine if order can be cancelled', () => {
    const createOrder = (status: OrderStatus) => {
      return new Order({
        userId: 'user-1',
        orderNumber: 'ORD-TEST-001',
        items: [],
        subtotal: new Money(100),
        tax: new Money(10),
        shipping: new Money(5),
        discount: new Money(0),
        total: new Money(115),
        status,
        paymentStatus: PaymentStatus.PAID,
        shippingAddress: new Address('123 Main St', 'NYC', 'NY', '10001', 'USA'),
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    };

    expect(createOrder(OrderStatus.PENDING).canCancel()).toBe(true);
    expect(createOrder(OrderStatus.CONFIRMED).canCancel()).toBe(true);
    expect(createOrder(OrderStatus.SHIPPED).canCancel()).toBe(false);
    expect(createOrder(OrderStatus.DELIVERED).canCancel()).toBe(false);
  });
});
