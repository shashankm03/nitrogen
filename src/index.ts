import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import express from 'express';
import { prismaClient } from "./prisma.js";


const honoApp = new Hono()


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// 1. Customers
app.post('/customers', async (req: express.Request, res: express.Response) => {
    const { name, email, phoneNumber, address } = req.body;
    const customer = await prisma.customer.create({ data: { name, email, phoneNumber, address } });
    res.json(customer);
});

app.get('/customers/:id', async (req: express.Request, res: express.Response) => {
    const customer = await prisma.customer.findUnique({ where: { id: Number(req.params.id) } });
    res.json(customer);
});

app.get('/customers/:id/orders', async (req: express.Request, res: express.Response) => {
    const orders = await prisma.order.findMany({ where: { customerId: Number(req.params.id) } });
    res.json(orders);
});

// 2. Restaurants
app.post('/restaurants', async (req: express.Request, res: express.Response) => {
    const { name, location } = req.body;
    const restaurant = await prisma.restaurant.create({ data: { name, location } });
    res.json(restaurant);
});

app.get('/restaurants/:id/menu', async (req: express.Request, res: express.Response) => {
    const menu = await prisma.menuItem.findMany({ where: { restaurantId: Number(req.params.id), isAvailable: true } });
    res.json(menu);
});

// 3. Menu Items
app.post('/restaurants/:id/menu', async (req: express.Request, res: express.Response) => {
    const { name, price, isAvailable } = req.body;
    const menuItem = await prisma.menuItem.create({ data: { name, price, isAvailable, restaurantId: Number(req.params.id) } });
    res.json(menuItem);
});

app.patch('/menu/:id', async (req: express.Request, res: express.Response) => {
    const menuItem = await prisma.menuItem.update({ where: { id: Number(req.params.id) }, data: req.body });
    res.json(menuItem);
});

// 4. Orders
app.post('/orders', async (req: express.Request, res: express.Response) => {
    const { customerId, restaurantId, items } = req.body;
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
        const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
        if (!menuItem) {
            res.status(400).json({ error: 'Invalid menu item' });
            return;
        }
        totalPrice += Number(menuItem.price) * item.quantity;
        orderItems.push({ menuItemId: item.menuItemId, quantity: item.quantity });
    }

    const order = await prisma.order.create({
        data: { customerId, restaurantId, totalPrice, status: 'Placed', orderItems: { create: orderItems } },
    });
    res.json(order);
});

app.get('/orders/:id', async (req: express.Request, res: express.Response) => {
    const order = await prisma.order.findUnique({ where: { id: Number(req.params.id) }, include: { orderItems: true } });
    res.json(order);
});

app.patch('/orders/:id/status', async (req: express.Request, res: express.Response) => {
    const order = await prisma.order.update({ where: { id: Number(req.params.id) }, data: { status: req.body.status } });
    res.json(order);
});

// 5. Reports & Insights
app.get('/restaurants/:id/revenue', async (req: express.Request, res: express.Response) => {
    const revenue = await prisma.order.aggregate({ _sum: { totalPrice: true }, where: { restaurantId: Number(req.params.id) } });
    res.json({ totalRevenue: revenue._sum.totalPrice || 0 });
});

app.get('/menu/top-items', async (req: express.Request, res: express.Response) => {
    const topItems = await prisma.orderItem.groupBy({ by: ['menuItemId'], _sum: { quantity: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 });
    res.json(topItems);
});

// app.get('/customers/top', async (req: express.Request, res: express.Response) => {
//     const topCustomers = await prisma.order.groupBy({ by: ['customerId'], _count: { customerId: true }, orderBy: { _count: { customerId: 'desc' } }, take: 5 });
//     res.json(topCustomers);
// });
app.get('/customers/top', async (req: express.Request, res: express.Response) => {
    try {
        const topCustomers = await prisma.order.groupBy({
            by: ['customerId'],
            _count: { customerId: true },
            orderBy: { _count: { customerId: 'desc' } },
            take: 5,
        });

        const customers = await Promise.all(
            topCustomers.map(async (customer) => {
                const customerDetails = await prisma.customer.findUnique({
                    where: { id: customer.customerId },
                    select: { id: true, name: true, email: true },
                });
                return { ...customerDetails, totalOrders: customer._count.customerId };
            })
        );

        res.json(customers);
    } catch (error) {
        console.error("Error fetching top customers:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
    

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});