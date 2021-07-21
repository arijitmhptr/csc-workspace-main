const { WebcController } = WebCardinal.controllers;
const cscServices = require("csc-services")
const OrdersService  = cscServices.OrderService;
const eventBusService = cscServices.EventBusService;
const Topics  = cscServices.constants.Topics;
const viewModelResolver = cscServices.viewModelResolver;

export default class ReviewOrderController extends WebcController {

    constructor(...props) {

        super(...props);
        let  order  = this.history.location.state.order;

        this.ordersService = new OrdersService(this.DSUStorage);

        this.model = {
            wizard_form: [
                { id: "wizard_form_step_1" , holder_id: "wizard_form_step_1_holder", name : "Order Details" , visible: true , validated: false },
                { id: "wizard_form_step_2" , holder_id: "wizard_form_step_2_holder", name : "Attach Documents" , visible: false , validated: false},
                { id: "wizard_form_step_3" , holder_id: "wizard_form_step_3_holder", name : "Comments" , visible: false, validated: false},
                { id: "wizard_form_step_4" , holder_id: "wizard_form_step_4_holder", name : "Confirmation" , visible: false, validated: false}
            ],
            wizard_form_navigation:[
                { id: "from_step_1_to_2", name: "Next", visible: true , validated: false },
                { id: "from_step_2_to_1", name: "Previous", visible: true , validated: false },
                { id: "from_step_2_to_3", name: "Next", visible: true , validated: false },
                { id: "from_step_3_to_2", name: "Previous", visible: true , validated: false },
                { id: "from_step_3_to_4", name: "Next", visible: true , validated: false },
            ],
            form: viewModelResolver("order").form,
            allComments:JSON.parse(JSON.stringify(order.comments)),
            order:order
        };

        this.model.form.inputs.sponsor_id.disabled=true;
        this.model.form.inputs.site_region_id.disabled=true;
        this.model.form.inputs.site_country.disabled=true;

        this.model.addExpression(
            "hasComments",
            () => {
                return this.model.form.comments.length >=1;
            },
            "form.comments.length"
        );

        this.model.onChange("form.inputs.add_comment.value",()=>{
            let comment = this.model.form.inputs.add_comment.value;
            this.model.allComments = [...this.model.form.comments]
            if(comment){
                this.model.allComments.push({
                    entity:"CMO",
                    date:new Date().toLocaleString(),
                    comment:comment
                })
            }
        })

        this.on('add-file', (event) => {

            const files = event.data;

            if(files){
                files.forEach( (file) => {
                    this.model.form.documents.push({ name: file.name , attached_by : "Novartis" , date: new Date().toLocaleString() , link : "" , file: file});
                })
            }

            if (event.data) this.docs = event.data;
        });

        // setTimeout( () => {
        //
        //     // Data Bind Event
        //     const targetCmoId = this.element.querySelector('#target_cmo_id');
        //     targetCmoId.addEventListener("change", (event)=>{this.onChange(event, 'target_cmo_id')});
        //
        //     // Data Bind Event
        //     const siteId = this.element.querySelector('#site_id');
        //     siteId.addEventListener("change", (event)=>{this.onChange(event , 'site_id')});
        //
        //     // Data Bind Event
        //     const deliveryDate = this.element.querySelector('#delivery_date');
        //     deliveryDate.addEventListener("change", (event)=>{this.updateDate(event);});
        //
        //     // Data Bind Event
        //     const deliveryTime = this.element.querySelector('#delivery_time');
        //     deliveryTime.addEventListener("change", (event)=>{this.updateTime(event);});
        //
        //
        //
        // },500);


        //When you click step 1
        this.onTagEvent('wizard_form_step_1', 'click', (e) => {
            makeStepActive("wizard_form_step_1", "wizard_form_step_1_holder" , e);
        });

        //When you click step 2
        this.onTagEvent('wizard_form_step_2', 'click', (e) => {
            makeStepActive("wizard_form_step_2", "wizard_form_step_2_holder" , e);
        });

        //When you click step 3
        this.onTagEvent('wizard_form_step_3', 'click', (e) => {
            makeStepActive("wizard_form_step_3", "wizard_form_step_3_holder" , e);
        });

        //When you click step 4
        this.onTagEvent('wizard_form_step_4', 'click', (e) => {
            makeStepActive("wizard_form_step_4", "wizard_form_step_4_holder" , e);
        });


        //STEP BUTTONS LOGIC

        //When you want to navigate from step 1 to step 2
        this.onTagEvent('from_step_1_to_2', 'click', (e) => {
            makeStepActive("wizard_form_step_2", "wizard_form_step_2_holder" , e);
        });

        //When you want to navigate from step 2 to step 1
        this.onTagEvent('from_step_2_to_1', 'click', (e) => {
            makeStepActive("wizard_form_step_1", "wizard_form_step_1_holder" , e);
        });

        //When you want to navigate from step 2 to step 3
        this.onTagEvent('from_step_2_to_3', 'click', (e) => {
            makeStepActive("wizard_form_step_3", "wizard_form_step_3_holder" , e);
        });

        //When you want to navigate from step 3 to step 2
        this.onTagEvent('from_step_3_to_2', 'click', (e) => {
            makeStepActive("wizard_form_step_2", "wizard_form_step_2_holder" , e);
        });

        //When you want to navigate from step 3 to step 2
        this.onTagEvent('from_step_3_to_4', 'click', (e) => {
            makeStepActive("wizard_form_step_4", "wizard_form_step_4_holder" , e);
        });


        //When you submit form
        this.onTagEvent('form_submit', 'click', (e) => {

            this.showErrorModal(
                new Error(`Are you sure you want to submit the review?`), // An error or a string, it's your choice
                'Submit Review',
                onSubmitYesResponse,
                onNoResponse,
                {
                    disableExpanding: true,
                    cancelButtonText: 'No',
                    confirmButtonText: 'Yes',
                    id: 'error-modal'
                }
            );


        });

        const onSubmitYesResponse = async () => {
            const payload = {};

            if(this.model.form){
                if(this.model.form.inputs){
                    let keys = Object.keys(this.model.form.inputs);
                    if(keys){
                        keys.forEach( (key) => {

                            if(key === 'delivery_date'){
                                payload['delivery_date'] = this.getDateTime();
                            }else if(key === 'keep_between_temperature'){
                                payload['keep_between_temperature'] = this.getTemperature();
                            }else{
                                payload[key] = this.model.form.inputs[key].value;
                            }
                        })
                    }
                }

                if(this.model.form.documents){
                    payload["files"] = [];
                    this.model.form.documents.forEach ((doc) => {
                        payload["files"].push(doc.file);
                    })
                }



                console.log("SUBMIT : Payload: " , payload);
                const orders = await this.ordersService.getOrders();

                let dbOrder = orders.find(_order=>_order.keySSI === order.keySSI);
                const dsuOrder = await this.ordersService.getOrder(order.keySSI,dbOrder.documentsKeySSI)
                console.log(dsuOrder);
                await this.ordersService.updateOrder(payload);
                await this.ordersService.finishReview(payload.files.filter(x => x !== undefined), [payload.add_comment], order.keySSI);
                
                eventBusService.emitEventListeners(Topics.RefreshNotifications, null);
            }


            this.createWebcModal({
                template: "orderCreatedModal",
                controller: "OrderCreatedModalController",
                disableBackdropClosing: false,
                disableFooter: true,
                disableHeader: true,
                disableExpanding: true,
                disableClosing: true,
                disableCancelButton: true,
                expanded: false,
                centered: true
            });
        };


        const onNoResponse = () => console.log('Why not?');

        //When you submit form
        this.onTagEvent('form_reset', 'click', (e) => {

            const payload = {};

            if(this.model.form){
                if(this.model.form.inputs){
                    let keys = Object.keys(this.model.form.inputs);
                    if(keys){
                        keys.forEach( (key) => {

                            if(key === 'delivery_date'){
                                payload['delivery_date'] = this.getDateTime();
                            }else if(key === 'keep_between_temperature'){
                                payload['keep_between_temperature'] = this.getTemperature();
                            }else{
                                this.model.form.inputs[key].value = "";
                            }
                        })
                    }
                }
            }
            console.log("SUBMIT : Payload: " , payload);

        });


        //Add active menu class to element
        function makeStepActive( step_id, step_holder_id , e ) {

            if(e){
                e.wizard_form.forEach( (item) => {
                    document.getElementById(item.id).classList.remove("new-order-wizard-active");
                    hideStep(item.holder_id);
                });

                document.getElementById(step_id).classList.add("new-order-wizard-active");

                showStep(step_holder_id);

            }
        }

        //Remove active menu class to element
        function makeMenuInActive( element ){
            document.getElementById(element).classList.remove("dashboard-tab-active");
        }

        function hideStep( item ){
            var el = document.getElementById(item);
            el.classList.remove("show-step");
            el.classList.add("hide-step");
        }

        function showStep( item ){
            var el = document.getElementById(item);
            el.classList.remove("hide-step");
            el.classList.add("show-step");
        }



    }

     onChange(event, id ){
         this.model.form.inputs[id].value = event.target.value;
    }


    updateDate(event){
        const value = event.target.value;
        this.model.form.inputs.delivery_date.date.value = value;
    }

    updateTime(event){
        const value = event.target.value;
        this.model.form.inputs.delivery_date.time.value = value;
    }

    getDateTime(){
        return this.model.form.inputs.delivery_date.date.value + ' ' + this.model.form.inputs.delivery_date.time.value;
    }

    getTemperature(){
        return {
            min: this.model.form.inputs.keep_between_temperature.min.value,
            max: this.model.form.inputs.keep_between_temperature.max.value
        };
    }

}
