const { WebcController } = WebCardinal.controllers;

const cscServices = require('csc-services');
const OrdersService = cscServices.OrderService;
const ShipmentsService = cscServices.ShipmentService;
const CommunicationService = cscServices.CommunicationService;
const NotificationsService = cscServices.NotificationsService;
const eventBusService = cscServices.EventBusService;
const { messagesEnum, order, shipment, NotificationTypes, Roles, Topics } = cscServices.constants;
const { orderStatusesEnum } = order;
const { shipmentStatusesEnum } = shipment;

const csIdentities = {};
csIdentities[Roles.Sponsor] = CommunicationService.identities.CSC.SPONSOR_IDENTITY;
csIdentities[Roles.CMO] = CommunicationService.identities.CSC.CMO_IDENTITY;
csIdentities[Roles.Site] = CommunicationService.identities.CSC.SITE_IDENTITY;
csIdentities[Roles.Courier] = CommunicationService.identities.CSC.COU_IDENTITY;

class DashboardController extends WebcController {
  constructor(...props) {
    super(...props);

    this.role = Roles.Courier;

    this.ordersService = new OrdersService(this.DSUStorage);
    this.shipmentService = new ShipmentsService(this.DSUStorage);
    this.communicationService = CommunicationService.getInstance(csIdentities[this.role]);
    this.notificationsService = new NotificationsService(this.DSUStorage, this.communicationService);

    this.model = {
      tabNavigator: {
        selected: '0'
      }
    };

    this.attachHandlers();
  }

  attachHandlers() {
    this.shipmentService.onReady(() => {
      this.handleMessages();
    });

    this.model.addExpression('isShipmentsSelected', () => this.model.tabNavigator.selected === '1', 'tabNavigator.selected');

    this.onTagClick('change-tab', async (model, target) => {
      document.getElementById(`tab-${this.model.tabNavigator.selected}`).classList.remove('active');
      this.model.tabNavigator.selected = target.getAttribute('data-custom');
      document.getElementById(`tab-${this.model.tabNavigator.selected}`).classList.add('active');
    });
  }

  handleMessages() {
    this.communicationService.listenForMessages(async (err, data) => {
      if (err) {
        return console.error(err);
      }
      this.handleShipmentMessages(data);
    });
  }


  async handleShipmentMessages(data) {
    data = JSON.parse(data);
    console.log('message received', data);
    const [shipmentData, shipmentStatus, notificationRole] = await this.processShipmentMessage(data);
    if (!shipmentData || !shipmentStatus || !notificationRole) {
      return;
    }

    console.log('shipment message received', shipmentData, shipmentStatus, notificationRole);
    const notification = {
      operation: NotificationTypes.UpdateShipmentStatus,
      shipmentId: shipmentData.shipmentId,
      read: false,
      status: shipmentStatus,
      keySSI: data.message.data.shipmentSSI,
      role: notificationRole,
      did: shipmentData.sponsorId,
      date: new Date().toISOString()
    };

    const notificationResult = await this.notificationsService.insertNotification(notification);
    eventBusService.emitEventListeners(Topics.RefreshNotifications, null);
    eventBusService.emitEventListeners(Topics.RefreshShipments, null);
    console.log('notification added', notification, notificationResult);
  }


  async processShipmentMessage(data) {
    let shipmentData;
    let shipmentStatus;
    let notificationRole;

    switch (data.message.operation) {
      case messagesEnum.ShipmentInPreparation: {
        notificationRole = Roles.CMO;
        shipmentStatus = shipmentStatusesEnum.InPreparation;

        const {
          shipmentSSI,
          statusSSI
        } = data.message.data;

        shipmentData = await this.shipmentService.mountAndReceiveShipment(shipmentSSI, this.role, statusSSI);
        break;
      }
    }

    return [shipmentData, shipmentStatus, notificationRole];
  }
}
export default DashboardController;