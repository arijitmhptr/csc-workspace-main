const { ViewShipmentBaseController } = WebCardinal.controllers;
const cscServices = require('csc-services');
const viewModelResolver = cscServices.viewModelResolver;
const ShipmentsService = cscServices.ShipmentService;
const OrdersService = cscServices.OrderService;
const CommunicationService = cscServices.CommunicationService;
const momentService = cscServices.momentService;
const { Commons, Roles } = cscServices.constants;
const { shipmentStatusesEnum } = cscServices.constants.shipment;
const statusesService = cscServices.StatusesService;

class CourierSingleShipmentController extends ViewShipmentBaseController {
  constructor(...props) {
    super(Roles.Courier,...props);
    let communicationService = CommunicationService.getInstance(CommunicationService.identities.CSC.COU_IDENTITY);
    this.ordersService = new OrdersService(this.DSUStorage, communicationService);
    this.shipmentsService = new ShipmentsService(this.DSUStorage, communicationService);
    this.initViewModel();
    this.openFirstAccordion();
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.showHistoryHandler();
    this.toggleAccordionItemHandler();
    this.downloadAttachmentHandler();
    this.navigationHandlers();

    this.onTagClick('scan-shipment-pickup', () => {
        this.navigateToPageTag('scan-shipment-pickup', {
            shipment: {
               shipmentId: this.model.shipmentModel.shipment.shipmentId,
                ...this.model.toObject('shipmentModel.shipment')
            }
            });
       });

    this.onTagEvent('edit-shipment', 'click', () => {
      this.navigateToPageTag('edit-shipment', {
        shipment: this.model.toObject('shipmentModel.shipment'),
        role: Roles.Courier
      });
    });

    this.onTagEvent('add-shipment-comment', 'click', (e) => {
      this.onAddShipmentCommentModalOpen();
    });

    this.onTagClick('deliver-shipment', () => {
      this.navigateToPageTag('deliver-shipment', {
        shipment: {
          shipmentId: this.model.shipmentModel.shipment.shipmentId,
          ...this.model.toObject('shipmentModel.shipment')
        }
      });
    });
  }

  setShipmentActions(shipment) {
    const actions = {
      canPickupShipment:false,
      canEditShipment:false,
      canAddMessage:false,
      canDeliverShipment:false
    };

    switch (shipment.status[0].status) {
      case shipmentStatusesEnum.ReadyForDispatch:
        actions.canPickupShipment = true;
        break;
      case shipmentStatusesEnum.PickUpAtWarehouse:
        actions.canEditShipment = true;
        break;
      case shipmentStatusesEnum.InTransit:
        actions.canAddMessage = true;
        actions.canDeliverShipment = true;
        break;
    }
    return actions;
  }

  async initViewModel() {
    const model = {
      orderModel: viewModelResolver('order'),
      shipmentModel: viewModelResolver('shipment'),
    };

    //all fields are disabled
    for (let prop in model.form) {
      model.form[prop].disabled = true;
    }
    let { keySSI } = this.history.location.state;
    model.keySSI = keySSI;
    let shipment = await this.shipmentsService.getShipment(model.keySSI);
    shipment = { ...this.transformShipmentData(shipment) };
    model.shipmentModel.shipment = shipment;
    console.log('Model : ', JSON.stringify(model.shipmentModel));

    if (model.shipmentModel.shipment.shipmentComments) {
      model.shipmentModel.shipment.comments = await this.getShipmentComments(model.shipmentModel.shipment);
    }

    if (model.shipmentModel.shipment.shipmentDocuments) {
      model.shipmentModel.shipment.documents = await this.getShipmentDocuments(model.shipmentModel.shipment);
    }

    model.actions = this.setShipmentActions(model.shipmentModel.shipment);

    let order = await this.ordersService.getOrder(model.shipmentModel.shipment.orderSSI);
    order = { ...this.transformOrderData(order) };
    model.orderModel.order = order
    //console.log("MODEL " + JSON.stringify(model));
    this.model = model;
    this.attachRefreshListeners();
  }

  transformOrderData(data) {
    if (data) {
      data.delivery_date = this.getDateTime(data.deliveryDate);
      return data;
    }
    return {};
  }

  onAddShipmentCommentModalOpen(){
    this.createWebcModal({
      template: 'addShipmentCommentModal',
      model:this.model,
      controller: 'AddShipmentCommentModalController',
      disableBackdropClosing: true,
      disableFooter: true,
      disableHeader: true,
      disableExpanding: true,
      disableClosing: false,
      disableCancelButton: true,
      expanded: false,
      centered: true,
    });
  }
}

export default CourierSingleShipmentController;
