/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
define([
    'underscore',
    'jquery',
    'knockout',
    'Magento_Ui/js/grid/columns/column',
    'Magento_AdobeStockImageAdminUi/js/action/authorization',
    'Magento_AdobeStockImageAdminUi/js/model/messages',
    'mage/translate'
], function (_, $, ko, Column, authorizationAction, messages) {
    'use strict';

    return Column.extend({
        defaults: {
            visibility: [],
            height: 0,
            saveAvailable: true,
            modules: {
                thumbnailComponent: '${ $.parentName }.thumbnail_url'
            },
            messageDelay: 5,
            authConfig: {
                url: '',
                isAuthorized: false,
                stopHandleTimeout: 10000,
                windowParams: {
                    width: 500,
                    height: 600,
                    top: 100,
                    left: 300,
                },
                response: {
                    regexpPattern: /auth\[code=(success|error);message=(.+)\]/,
                    codeIndex: 1,
                    messageIndex: 2,
                    successCode: 'success',
                    errorCode: 'error'
                }
            }
        },

        /**
         * Init observable variables
         * @return {Object}
         */
        initObservable: function () {
            this._super()
                .observe([
                    'visibility',
                    'height'
                ]);

            this.height.subscribe(function(){
                this.thumbnailComponent().previewHeight(this.height());
            }, this);
            return this;
        },

        /**
         * Returns url to given record.
         *
         * @param {Object} record - Data to be preprocessed.
         * @returns {String}
         */
        getUrl: function (record) {
            return record.preview_url;
        },

        /**
         * Returns title to given record.
         *
         * @param {Object} record - Data to be preprocessed.
         * @returns {String}
         */
        getTitle: function (record) {
            return record.title || 'Title';
        },

        /**
         * Returns author full name to given record.
         *
         * @param {Object} record - Data to be preprocessed.
         * @returns {String}
         */
        getAuthor: function (record) {
            return record.author || 'Author';
        },

        /**
         * Returns visibility for given record.
         *
         * @param {Object} record
         * @return {*|boolean}
         */
        isVisible: function (record) {
            return this.visibility()[record._rowIndex] || false;
        },

        /**
         * Get styles for preview
         *
         * @param {Object} record
         * @returns {Object}
         */
        getStyles: function (record){
            if(!record.previewStyles) {
                record.previewStyles = ko.observable();
            }
            record.previewStyles({
                'margin-top': '-' + this.height()
            });
            return record.previewStyles;
        },

        /**
         * Next image preview
         *
         * @param record
         */
        next: function(record){
            this._selectRow(record.lastInRow ? record.currentRow + 1 : record.currentRow);
            this.show(record._rowIndex + 1);
        },

        /**
         * Previous image preview
         *
         * @param record
         */
        prev: function(record){
            this._selectRow(record.firstInRow ? record.currentRow - 1 : record.currentRow);
            this.show(record._rowIndex - 1);
        },

        /**
         * Set selected row id
         *
         * @param {Number} rowId
         * @param {Number} [height]
         * @private
         */
        _selectRow(rowId, height){
            this.thumbnailComponent().previewRowId(rowId);
        },

        /**
         * Show image preview
         *
         * @param {Object|Number} record
         */
        show: function (record) {
            var visibility = this.visibility();
            if(~visibility.indexOf(true)) {// hide any preview
                if(!Array.prototype.fill) {
                    visibility = _.times(visibility.length, _.constant(false));
                } else {
                    visibility.fill(false);
                }
            }
            if(this._isInt(record)) {
                visibility[record] = true;
            } else {
                this._selectRow(record.currentRow);
                visibility[record._rowIndex] = true;
            }
            this.visibility(visibility);

            var $img = $('[data-image-preview] img');
            if($img.get(0).complete) {
                this._updateHeight();
            } else {
                $img.load(this._updateHeight.bind(this));
            }
        },

        /**
         *
         * @private
         */
        _updateHeight: function (){
            var $preview = $('[data-image-preview]');
            this.height($preview.height() + 'px');// set height
            this.visibility(this.visibility());// rerender
            $preview.get(0).scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"});// update scroll if needed
        },

        /**
         * Close image preview
         *
         * @param {Object} record
         */
        hide: function (record) {
            var visibility = this.visibility();
            visibility[record._rowIndex] = false;
            this.visibility(visibility);
            this.height(0);
            this._selectRow(null, 0);
        },

        /**
         * Check if value is integer
         *
         * @param value
         * @returns {boolean}
         * @private
         */
        _isInt: function(value) {
            return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
        },

        /**
         * Save record as image
         *
         * @param record
         */
        save: function(record) {
            // update modal with an image url
            var image_url = record.preview_url;
            var targetEl = $('.media-gallery-modal:has(#search_adobe_stock)').data('mageMediabrowser').getTargetElement();
            targetEl.val(image_url).trigger('change');
            // close insert image panel
            window.MediabrowserUtility.closeDialog();
            targetEl.focus();
            $(targetEl).change();
            // close adobe panel
            $("#adobe-stock-images-search-modal").trigger('closeModal');
        },

        /**
         * Get messages
         *
         * @return {Array}
         */
        getMessages: function() {
            return messages.get();
        },

        /**
         * License and save image
         *
         * @param {Object} record
         */
        licenseAndSave: function (record) {
            /** @todo add license functionality */
            console.warn('add license functionality');
            console.dir(record);
        },

        /**
         * Process of license
         *
         * @param {Object} record
         */
        licenseProcess: function (record) {
            if (this.authConfig.isAuthorized) {
                this.licenseAndSave(record);

                return;
            }

            /**
             * Opens authorization window of Adobe Stock
             * then starts the authorization process
             */
            authorizationAction(this.authConfig)
                .then(
                    function (authConfig) {
                        this.authConfig = _.extend(this.authConfig, authConfig);
                        this.licenseProcess(record);
                        messages.add('success', authConfig.lastAuthSuccessMessage);
                    }.bind(this)
                )
                .catch(
                    function (error) {
                        messages.add('error', error.message);
                    }.bind(this)
                )
                .finally((function () {
                    messages.scheduleCleanup(this.messageDelay);
                }).bind(this));
        }
    });
});