import { NotificationsService } from './service.js';
import { getNotificationsSchema } from './schema.js';
import logger from '../../config/logger.js';

const service = new NotificationsService();

export const getUserNotifications = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeId;
    const validatedQuery = getNotificationsSchema.parse(req.query);

    const notifications = await service.getUserNotifications(employeeId, validatedQuery);

    res.json({
      success: true,
      data: notifications,
      message: 'Notifications retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getAllNotifications = async (req, res, next) => {
  try {
    // [ROLE-BASED VISIBILITY] Pass role so the service can restrict the
    // system-wide view to admins.
    const { employeeId, role } = req.user;
    const notifications = await service.getAllSystemNotifications(employeeId, { role });

    res.json({
      success: true,
      data: notifications,
      message: 'All system notifications retrieved',
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const employeeId = req.user.employeeId;

    const { role } = req.user;

    await service.markAsRead(parseInt(notificationId), employeeId, role);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
};

export const acknowledgeNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const employeeId = req.user.employeeId;

    const { role } = req.user;

    await service.acknowledgeNotification(parseInt(notificationId), employeeId, role);

    res.json({
      success: true,
      message: 'Notification acknowledged',
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeId;
    const count = await service.getUnreadCount(employeeId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    next(error);
  }
};

export const getCriticalAlerts = async (req, res, next) => {
  try {
    const employeeId = req.user.employeeId;
    const alerts = await service.getCriticalAlerts(employeeId);

    res.json({
      success: true,
      data: alerts,
      message: 'Critical alerts retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const employeeId = req.user.employeeId;

    const { role } = req.user;

    await service.deleteNotification(parseInt(notificationId), employeeId, role);

    logger.info('Notification deleted', { notificationId, employeeId });

    res.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
// --- Rule Management ---

export const createRule = async (req, res, next) => {
  try {
    const rule = await service.createRule(req.body);
    res.status(201).json({
      success: true,
      data: rule,
      message: 'Notification rule created successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRule = async (req, res, next) => {
  try {
    const { ruleId } = req.params;
    await service.deleteRule(parseInt(ruleId));
    res.json({
      success: true,
      message: 'Notification rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getAllRules = async (req, res, next) => {
  try {
    const rules = await service.getAllRules();
    res.json({
      success: true,
      data: rules,
    });
  } catch (error) {
    next(error);
  }
};

export const seedRules = async (req, res, next) => {
  try {
    const result = await service.seedDefaultRules();
    res.json({
      success: true,
      data: result,
      message: `Seeded ${result.seeded} default rules`,
    });
  } catch (error) {
    next(error);
  }
};
