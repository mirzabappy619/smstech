// Domain Entities - Core business objects

import { v4 as uuidv4 } from 'uuid';

// ==============================================
// BASE ENTITY
// ==============================================
export abstract class Entity<T> {
  protected readonly _id: string;
  protected props: T;

  constructor(props: T, id?: string) {
    this._id = id ?? uuidv4();
    this.props = props;
  }

  get id(): string {
    return this._id;
  }

  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) return false;
    if (this === entity) return true;
    return this._id === entity._id;
  }
}

// ==============================================
// VALUE OBJECTS
// ==============================================
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'USD'
  ) {
    if (amount < 0) throw new Error('Amount cannot be negative');
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot subtract different currencies');
    }
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  format(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency,
    }).format(this.amount);
  }
}

// ==============================================
// UNIT SYSTEM VALUE OBJECT
// ==============================================
export type BaseUnit = 'piece' | 'pair' | 'dozen' | 'pack';

export class UnitSystem {
  constructor(
    public readonly baseUnit: BaseUnit,
    public readonly unitsPerPackage: number,
    public readonly packageName: string
  ) {
    if (unitsPerPackage < 1) {
      throw new Error('Units per package must be at least 1');
    }
  }

  /** Convert package quantity to individual units */
  getIndividualUnits(packageQuantity: number): number {
    return packageQuantity * this.unitsPerPackage;
  }

  /** Convert individual units to number of packages (rounded up) */
  getPackageQuantity(individualUnits: number): number {
    return Math.ceil(individualUnits / this.unitsPerPackage);
  }

  toJSON(): { baseUnit: BaseUnit; unitsPerPackage: number; packageName: string } {
    return {
      baseUnit: this.baseUnit,
      unitsPerPackage: this.unitsPerPackage,
      packageName: this.packageName,
    };
  }

  static default(): UnitSystem {
    return new UnitSystem('piece', 1, 'Individual');
  }

  static fromJSON(data: { baseUnit: BaseUnit; unitsPerPackage: number; packageName: string }): UnitSystem {
    return new UnitSystem(data.baseUnit, data.unitsPerPackage, data.packageName);
  }
}

// ==============================================
// ATTRIBUTE DEFINITION
// ==============================================
export interface AttributeDefinition {
  name: string;          // e.g. "color"
  displayName: string;   // e.g. "Color"
  values: string[];      // e.g. ["Red", "Blue", "Green"]
  displayOrder: number;
}

// ==============================================
// WAREHOUSE STOCK
// ==============================================
export interface WarehouseStock {
  warehouseId: string;
  warehouseName?: string;
  quantityInPackages: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export class Email {
  private readonly value: string;

  constructor(email: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    this.value = email.toLowerCase();
  }

  toString(): string {
    return this.value;
  }
}

export class PhoneNumber {
  private readonly value: string;

  constructor(phone: string) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 15) {
      throw new Error('Invalid phone number');
    }
    this.value = cleaned;
  }

  toString(): string {
    return this.value;
  }

  format(): string {
    const match = this.value.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return this.value;
  }
}

export class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly postalCode: string,
    public readonly country: string,
    public readonly apartment?: string
  ) {}

  format(): string {
    const parts = [this.street];
    if (this.apartment) parts.push(this.apartment);
    parts.push(`${this.city}, ${this.state} ${this.postalCode}`);
    parts.push(this.country);
    return parts.join('\n');
  }
}

// ==============================================
// USER ENTITY
// ==============================================
export interface UserProps {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  avatarUrl?: string;
  addresses: Address[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  OWNER = 'owner',
  DELIVERY = 'delivery',
}

export class User extends Entity<UserProps> {
  get email(): string { return this.props.email; }
  get firstName(): string { return this.props.firstName; }
  get lastName(): string { return this.props.lastName; }
  get fullName(): string { return `${this.props.firstName} ${this.props.lastName}`; }
  get phone(): string | undefined { return this.props.phone; }
  get role(): UserRole { return this.props.role; }
  get isActive(): boolean { return this.props.isActive; }
  get isEmailVerified(): boolean { return this.props.isEmailVerified; }
  get avatarUrl(): string | undefined { return this.props.avatarUrl; }
  get addresses(): Address[] { return [...this.props.addresses]; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }
  get lastLoginAt(): Date | undefined { return this.props.lastLoginAt; }

  isAdmin(): boolean {
    return this.props.role === UserRole.ADMIN || this.props.role === UserRole.OWNER;
  }

  addAddress(address: Address): void {
    this.props.addresses.push(address);
    this.props.updatedAt = new Date();
  }

  updateProfile(data: Partial<Pick<UserProps, 'firstName' | 'lastName' | 'phone' | 'avatarUrl'>>): void {
    Object.assign(this.props, data);
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  static create(props: Omit<UserProps, 'createdAt' | 'updatedAt' | 'isActive' | 'isEmailVerified' | 'addresses'>, id?: string): User {
    return new User({
      ...props,
      isActive: true,
      isEmailVerified: false,
      addresses: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }, id);
  }
}

// ==============================================
// PRODUCT ENTITY
// ==============================================
export interface ProductVariation {
  id: string;
  productId?: string;
  name: string;
  sku: string;
  price: Money;
  compareAtPrice?: Money;
  stock: number;
  attributes: Record<string, string>; // e.g., { size: 'M', color: 'Blue' }
  images: string[];
  isActive: boolean;
  isAutoGenerated?: boolean;        // Whether created by the auto-generate algorithm
  warehouseStocks?: WarehouseStock[]; // Per-location inventory

  /** Static factory to create a variation from raw data */
  // (use ProductVariation.create() helper below)
}

export interface ProductProps {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  brandId?: string;
  basePrice: Money;
  compareAtPrice?: Money;
  variations: ProductVariation[];
  images: string[];
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
  isActive: boolean;
  isFeatured: boolean;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  unitSystem: UnitSystem;
  attributeDefinitions: AttributeDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export class Product extends Entity<ProductProps> {
  get name(): string { return this.props.name; }
  get slug(): string { return this.props.slug; }
  get description(): string { return this.props.description; }
  get shortDescription(): string | undefined { return this.props.shortDescription; }
  get sku(): string { return this.props.sku; }
  get barcode(): string | undefined { return this.props.barcode; }
  get categoryId(): string { return this.props.categoryId; }
  get brandId(): string | undefined { return this.props.brandId; }
  get basePrice(): Money { return this.props.basePrice; }
  get compareAtPrice(): Money | undefined { return this.props.compareAtPrice; }
  get variations(): ProductVariation[] { return [...this.props.variations]; }
  get images(): string[] { return [...this.props.images]; }
  get tags(): string[] { return [...this.props.tags]; }
  get seoTitle(): string { return this.props.seoTitle ?? this.props.name; }
  get seoDescription(): string { return this.props.seoDescription ?? this.props.shortDescription ?? this.props.description.slice(0, 160); }
  get isActive(): boolean { return this.props.isActive; }
  get isFeatured(): boolean { return this.props.isFeatured; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get totalStock(): number {
    if (this.props.variations.length === 0) return 0;
    return this.props.variations.reduce((sum, v) => sum + v.stock, 0);
  }

  get lowestPrice(): Money {
    if (this.props.variations.length === 0) return this.props.basePrice;
    return this.props.variations.reduce(
      (min, v) => (v.price.amount < min.amount ? v.price : min),
      this.props.variations[0].price
    );
  }

  get hasDiscount(): boolean {
    return !!this.props.compareAtPrice && this.props.compareAtPrice.amount > this.props.basePrice.amount;
  }

  getVariation(variationId: string): ProductVariation | undefined {
    return this.props.variations.find(v => v.id === variationId);
  }

  get unitSystem(): UnitSystem { return this.props.unitSystem; }

  get attributeDefinitions(): AttributeDefinition[] {
    return [...this.props.attributeDefinitions];
  }

  updateStock(variationId: string, quantity: number): void {
    const variation = this.props.variations.find(v => v.id === variationId);
    if (variation) {
      variation.stock += quantity;
      this.props.updatedAt = new Date();
    }
  }

  /**
   * Auto-generate all variation combinations from attribute definitions.
   * e.g. color×size = Red-S, Red-M, Blue-S, Blue-M ...
   */
  generateVariations(): ProductVariation[] {
    const attributeDefs = this.props.attributeDefinitions;
    if (attributeDefs.length === 0) return [];

    // Build Cartesian product of all attribute values
    const combinations: Record<string, string>[] = [];
    const generateCombos = (
      attrs: AttributeDefinition[],
      current: Record<string, string> = {},
      idx = 0
    ): void => {
      if (idx === attrs.length) {
        combinations.push({ ...current });
        return;
      }
      attrs[idx].values.forEach(value => {
        generateCombos(attrs, { ...current, [attrs[idx].name]: value }, idx + 1);
      });
    };
    generateCombos(attributeDefs);

    return combinations.map((combo, idx) => ({
      id: `auto-${idx}`,
      productId: this.id,
      name: Object.entries(combo)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', '),
      sku: `${this.props.sku}-${String(idx + 1).padStart(3, '0')}`,
      price: this.props.basePrice,
      stock: 0,
      attributes: combo,
      images: [],
      isActive: true,
      isAutoGenerated: true,
    }));
  }

  /** Add an attribute and regenerate variations */
  addAttribute(name: string, displayName: string, values: string[]): void {
    const exists = this.props.attributeDefinitions.some(a => a.name === name);
    if (exists) throw new Error(`Attribute "${name}" already exists`);
    this.props.attributeDefinitions.push({
      name,
      displayName,
      values,
      displayOrder: this.props.attributeDefinitions.length,
    });
    this.props.updatedAt = new Date();
  }

  /** Remove an attribute by name */
  removeAttribute(name: string): void {
    this.props.attributeDefinitions = this.props.attributeDefinitions.filter(
      a => a.name !== name
    );
    this.props.updatedAt = new Date();
  }

  static create(
    props: Omit<ProductProps, 'createdAt' | 'updatedAt' | 'unitSystem' | 'attributeDefinitions'>
      & { unitSystem?: UnitSystem; attributeDefinitions?: AttributeDefinition[] },
    id?: string
  ): Product {
    return new Product({
      ...props,
      unitSystem: props.unitSystem ?? UnitSystem.default(),
      attributeDefinitions: props.attributeDefinitions ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }, id);
  }
}

// ==============================================
// CATEGORY ENTITY
// ==============================================
export interface CategoryProps {
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  image?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Category extends Entity<CategoryProps> {
  get name(): string { return this.props.name; }
  get slug(): string { return this.props.slug; }
  get description(): string | undefined { return this.props.description; }
  get parentId(): string | undefined { return this.props.parentId; }
  get image(): string | undefined { return this.props.image; }
  get isActive(): boolean { return this.props.isActive; }
  get sortOrder(): number { return this.props.sortOrder; }

  static create(props: Omit<CategoryProps, 'createdAt' | 'updatedAt'>, id?: string): Category {
    return new Category({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, id);
  }
}

// ==============================================
// ORDER ENTITY
// ==============================================
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface OrderItem {
  id: string;
  productId: string;
  variationId?: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  image?: string;
}

export interface OrderNote {
  id: string;
  content: string;
  isInternal: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface OrderProps {
  userId: string;
  orderNumber: string;
  items: OrderItem[];
  subtotal: Money;
  tax: Money;
  shipping: Money;
  discount: Money;
  total: Money;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  shippingAddress: Address;
  billingAddress?: Address;
  notes: OrderNote[];
  couponCode?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Order extends Entity<OrderProps> {
  get userId(): string { return this.props.userId; }
  get orderNumber(): string { return this.props.orderNumber; }
  get items(): OrderItem[] { return [...this.props.items]; }
  get subtotal(): Money { return this.props.subtotal; }
  get tax(): Money { return this.props.tax; }
  get shipping(): Money { return this.props.shipping; }
  get discount(): Money { return this.props.discount; }
  get total(): Money { return this.props.total; }
  get status(): OrderStatus { return this.props.status; }
  get paymentStatus(): PaymentStatus { return this.props.paymentStatus; }
  get shippingAddress(): Address { return this.props.shippingAddress; }
  get trackingNumber(): string | undefined { return this.props.trackingNumber; }
  get notes(): OrderNote[] { return [...this.props.notes]; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get itemCount(): number {
    return this.props.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  canCancel(): boolean {
    return [OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(this.props.status);
  }

  canRefund(): boolean {
    return this.props.paymentStatus === PaymentStatus.PAID &&
           [OrderStatus.DELIVERED, OrderStatus.SHIPPED].includes(this.props.status);
  }

  updateStatus(status: OrderStatus): void {
    this.props.status = status;
    this.props.updatedAt = new Date();
    if (status === OrderStatus.DELIVERED) {
      this.props.deliveredAt = new Date();
    } else if (status === OrderStatus.CANCELLED) {
      this.props.cancelledAt = new Date();
    }
  }

  addNote(content: string, createdBy: string, isInternal: boolean = false): void {
    this.props.notes.push({
      id: uuidv4(),
      content,
      isInternal,
      createdBy,
      createdAt: new Date(),
    });
    this.props.updatedAt = new Date();
  }

  setTracking(trackingNumber: string, estimatedDelivery?: Date): void {
    this.props.trackingNumber = trackingNumber;
    this.props.estimatedDelivery = estimatedDelivery;
    this.props.updatedAt = new Date();
  }

  static generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${year}${month}${day}-${random}`;
  }

  static create(props: Omit<OrderProps, 'createdAt' | 'updatedAt' | 'orderNumber' | 'notes'>, id?: string): Order {
    return new Order({
      ...props,
      orderNumber: Order.generateOrderNumber(),
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }, id);
  }
}

// ==============================================
// CART ENTITY
// ==============================================
export interface CartItem {
  id: string;
  productId: string;
  variationId?: string;
  quantity: number;
  addedAt: Date;
}

export interface CartProps {
  userId?: string;
  sessionId: string;
  items: CartItem[];
  couponCode?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class Cart extends Entity<CartProps> {
  get userId(): string | undefined { return this.props.userId; }
  get sessionId(): string { return this.props.sessionId; }
  get items(): CartItem[] { return [...this.props.items]; }
  get couponCode(): string | undefined { return this.props.couponCode; }
  get expiresAt(): Date { return this.props.expiresAt; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  get itemCount(): number {
    return this.props.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  isAbandoned(): boolean {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return this.props.updatedAt < thirtyMinutesAgo && !this.isEmpty;
  }

  addItem(productId: string, quantity: number = 1, variationId?: string): void {
    const existingItem = this.props.items.find(
      item => item.productId === productId && item.variationId === variationId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      this.props.items.push({
        id: uuidv4(),
        productId,
        variationId,
        quantity,
        addedAt: new Date(),
      });
    }
    this.props.updatedAt = new Date();
  }

  updateItemQuantity(itemId: string, quantity: number): void {
    const item = this.props.items.find(i => i.id === itemId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(itemId);
      } else {
        item.quantity = quantity;
        this.props.updatedAt = new Date();
      }
    }
  }

  removeItem(itemId: string): void {
    this.props.items = this.props.items.filter(i => i.id !== itemId);
    this.props.updatedAt = new Date();
  }

  clear(): void {
    this.props.items = [];
    this.props.couponCode = undefined;
    this.props.updatedAt = new Date();
  }

  applyCoupon(code: string): void {
    this.props.couponCode = code;
    this.props.updatedAt = new Date();
  }

  static create(sessionId: string, userId?: string, id?: string): Cart {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    return new Cart({
      sessionId,
      userId,
      items: [],
      expiresAt,
      createdAt: now,
      updatedAt: now,
    }, id);
  }
}

// ==============================================
// INVENTORY ENTITY
// ==============================================
export interface InventoryLogEntry {
  id: string;
  type: 'adjustment' | 'sale' | 'return' | 'restock';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  orderId?: string;
  createdBy: string;
  createdAt: Date;
}

export interface InventoryProps {
  productId: string;
  variationId?: string;
  locationId: string;
  sku: string;
  stock: number;
  reservedStock: number;
  lowStockThreshold: number;
  logs: InventoryLogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export class Inventory extends Entity<InventoryProps> {
  get productId(): string { return this.props.productId; }
  get variationId(): string | undefined { return this.props.variationId; }
  get locationId(): string { return this.props.locationId; }
  get sku(): string { return this.props.sku; }
  get stock(): number { return this.props.stock; }
  get reservedStock(): number { return this.props.reservedStock; }
  get availableStock(): number { return this.props.stock - this.props.reservedStock; }
  get lowStockThreshold(): number { return this.props.lowStockThreshold; }
  get logs(): InventoryLogEntry[] { return [...this.props.logs]; }

  isLowStock(): boolean {
    return this.availableStock <= this.props.lowStockThreshold;
  }

  isOutOfStock(): boolean {
    return this.availableStock <= 0;
  }

  canFulfill(quantity: number): boolean {
    return this.availableStock >= quantity;
  }

  adjustStock(quantity: number, reason: string, createdBy: string, orderId?: string): void {
    const previousStock = this.props.stock;
    this.props.stock += quantity;
    this.props.logs.push({
      id: uuidv4(),
      type: 'adjustment',
      quantity,
      previousStock,
      newStock: this.props.stock,
      reason,
      orderId,
      createdBy,
      createdAt: new Date(),
    });
    this.props.updatedAt = new Date();
  }

  reserve(quantity: number): boolean {
    if (!this.canFulfill(quantity)) return false;
    this.props.reservedStock += quantity;
    this.props.updatedAt = new Date();
    return true;
  }

  releaseReservation(quantity: number): void {
    this.props.reservedStock = Math.max(0, this.props.reservedStock - quantity);
    this.props.updatedAt = new Date();
  }

  deductForSale(quantity: number, orderId: string, createdBy: string): void {
    const previousStock = this.props.stock;
    this.props.stock -= quantity;
    this.props.reservedStock = Math.max(0, this.props.reservedStock - quantity);
    this.props.logs.push({
      id: uuidv4(),
      type: 'sale',
      quantity: -quantity,
      previousStock,
      newStock: this.props.stock,
      orderId,
      createdBy,
      createdAt: new Date(),
    });
    this.props.updatedAt = new Date();
  }

  static create(props: Omit<InventoryProps, 'createdAt' | 'updatedAt' | 'logs' | 'reservedStock'>, id?: string): Inventory {
    return new Inventory({
      ...props,
      reservedStock: 0,
      logs: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }, id);
  }
}

// ==============================================
// EXPORTS
// ==============================================
