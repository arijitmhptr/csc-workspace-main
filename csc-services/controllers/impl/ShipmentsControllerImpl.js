const { WebcController } = WebCardinal.controllers;

const cscServices = require('csc-services');

const statusesService = cscServices.StatusesService;
const eventBusService = cscServices.EventBusService;
const momentService = cscServices.momentService;
const SearchService = cscServices.SearchService;
const ShipmentService = cscServices.ShipmentService;
const { Topics, Commons, Roles } = cscServices.constants;
const {
  shipmentStatusesEnum,
  shipmentCMOTableHeaders,
  shipmentSiteTableHeaders,
  shipmentSponsorTableHeaders,
  shipmentCourierTableHeaders
} = cscServices.constants.shipment;

class ShipmentsControllerImpl extends WebcController {

  constructor(role, ...props) {
    super(...props);

    this.role = role;
    this.model = this.getShipmentsViewModel();
    this.model.shipmentsListIsReady = false;
    this.shipmentService = new ShipmentService(this.DSUStorage);
    
    const tableHeaders = this.getTableHeaders();
    this.searchService = new SearchService(shipmentStatusesEnum, tableHeaders);

    this.init();
    this.attachEvents();
  }

  async init() {
    await this.getShipments();
    this.searchFilterHandler();
    this.filterChangedHandler();
    this.filterClearedHandler();
    eventBusService.addEventListener(Topics.RefreshShipments, async (data) => {
      await this.getShipments();
    });
  }

  async getShipments() {
    try {
      this.model.shipmentsListIsReady = false;
      const shipmentsList = await this.shipmentService.getShipments();
      this.shipments = this.transformData(shipmentsList);
      this.setShipmentsModel(this.shipments);
      this.model.shipmentsListIsReady = true;
    } catch (error) {
      console.log(error);
    }
  }

  setShipmentsModel(shipments) {
    this.model.shipments = shipments;
    this.model.data = shipments;
    this.model.headers = this.model.headers.map((x) => ({ ...x, asc: false, desc: false }));
  }

  attachEvents() {
    this.attachEventHandlers();
    this.viewShipmentHandler();
  }

  transformData(data) {
    if (data) {
      const statuses = statusesService.getShipmentStatusesByRole(this.role);
      const normalStatuses = statuses.normalStatuses;
      const approvedStatuses = statuses.approvedStatuses;

      data.forEach((item) => {
        item.orderId = item.orderId || '-';
        item.shipmentId = item.shipmentId || '-';
        item.shipperId = item.shipperId || '-';
        item.origin = item.origin || '-';
        item.type = item.shipmentType || '-';
        item.recipientName = item.recipientName || '-';

        const latestStatus = item.status.sort(function(a, b) {
          return new Date(b.date) - new Date(a.date);
        })[0];

        item.status_value = latestStatus.status === shipmentStatusesEnum.ShipmentCancelled ? shipmentStatusesEnum.Cancelled : latestStatus.status;
        item.status_approved = approvedStatuses.indexOf(item.status_value) !== -1;
        item.status_cancelled = item.status_value === shipmentStatusesEnum.Cancelled;
        item.status_normal = normalStatuses.indexOf(item.status_value) !== -1;

        item.lastModified = latestStatus.date ? momentService(latestStatus.date).format(Commons.DateTimeFormatPattern) : '-';
        item.requestDate = item.requestDate ? momentService(item.requestDate).format(Commons.DateTimeFormatPattern) : '-';
        item.deliveryDate = item.deliveryDate ? momentService(item.deliveryDate).format(Commons.DateTimeFormatPattern) : '-';
        item.scheduledPickupDate = this.getPickupDateTime(item.scheduledPickupDateTime);
      });
    }

    return data;
  }

  viewShipmentHandler() {
    this.onTagClick('view-shipment', (model) => {
      this.navigateToPageTag('shipment', { keySSI: model.keySSI });
    });
  }

  searchFilterHandler() {
    this.model.onChange('search.value', () => {
      setTimeout(() => {
        this.filterData();
      }, 300);
    });
  }

  filterChangedHandler() {
    this.onTagClick('filters-changed', async (model, target) => {
      const selectedFilter = target.getAttribute('data-custom') || null;
      if (selectedFilter) {
        this.querySelector(`#filter-${this.model.filter}`).classList.remove('selected');
        this.model.filter = selectedFilter;
        this.querySelector(`#filter-${this.model.filter}`).classList.add('selected');
        this.filterData();
      }
    });
  }

  filterClearedHandler() {
    this.onTagClick('filters-cleared', async () => {
      this.querySelector(`#filter-${this.model.filter}`).classList.remove('selected');
      this.model.filter = '';
      this.querySelector(`#filter-${this.model.filter}`).classList.add('selected');
      this.model.search.value = null;
      this.filterData();
    });
  }

  filterData() {
    let result = this.shipments;
    result = this.searchService.filterData(result, this.model.filter, this.model.search.value);
    this.setShipmentsModel(result);
  }

  attachEventHandlers() {
    //TODO due to many shipments changes the expression handler is triggered more than once
    this.model.addExpression('shipmentsListNotEmpty', () => {
      return this.model.shipments && Array.isArray(this.model.shipments) && this.model.shipments.length > 0;
    }, 'shipments');
  }

  getShipmentsViewModel() {
    const tableHeaders = this.getTableHeaders();
    return {
      filter: '',
      search: this.getSearchViewModel(),
      pagination: this.getPaginationViewModel(),
      headers: tableHeaders,
      tableLength: tableHeaders.length,
      shipments: [],
      defaultSortingRule: {
        sorting: 'desc',
        column: "lastModified",
        type : 'date'
      }
    };
  }

  getSearchViewModel() {
    return {
      placeholder: 'Search',
      value: ''
    };
  }

  getPaginationViewModel() {
    const itemsPerPageArray = [5, 10, 15, 20, 30];

    return {
      previous: false,
      next: false,
      items: [],
      pages: {
        selectOptions: ''
      },
      slicedPages: [],
      currentPage: 0,
      itemsPerPage: 10,
      totalPages: null,
      itemsPerPageOptions: {
        selectOptions: itemsPerPageArray.join(' | '),
        value: itemsPerPageArray[1].toString()
      }
    };
  }

  getPickupDateTime(scheduledPickupDate) {
    if (scheduledPickupDate && scheduledPickupDate.date && scheduledPickupDate.time) {
      const timestamp = new Date(`${scheduledPickupDate.date} ${scheduledPickupDate.time}`).getTime();
      return momentService(timestamp).format(Commons.DateTimeFormatPattern);
    }else{
      return '-';
    }
  }

  getTableHeaders() {
    switch (this.role) {
      case Roles.CMO: {
        return shipmentCMOTableHeaders;
      }
      case Roles.Site: {
        return shipmentSiteTableHeaders;
      }
      case Roles.Sponsor: {
        return shipmentSponsorTableHeaders;
      }
      case Roles.Courier:{
        return shipmentCourierTableHeaders
      }
    }

    return [];
  }
}

const controllersRegistry = require('../ControllersRegistry').getControllersRegistry();
controllersRegistry.registerController('ShipmentsController', ShipmentsControllerImpl);
