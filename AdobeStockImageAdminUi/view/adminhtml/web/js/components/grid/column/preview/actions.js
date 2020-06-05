/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
define([
    'uiComponent',
    'uiRegistry',
    'jquery',
    'Magento_AdobeStockImageAdminUi/js/action/save',
    'Magento_AdobeStockImageAdminUi/js/action/savePreview',
    'Magento_AdobeStockImageAdminUi/js/action/saveLicensed',
    'Magento_AdobeStockImageAdminUi/js/action/licenseAndSave',
    'Magento_AdobeStockImageAdminUi/js/action/confirmQuota',
    'Magento_AdobeStockImageAdminUi/js/media-gallery',
    'Magento_AdobeStockImageAdminUi/js/confirmation/buyCredits'
], function (
    Component,
    uiRegistry,
    $,
    saveAction,
    savePreviewAction,
    saveLicensedAction,
    licenseAndSaveAction,
    confirmQuotaAction,
    mediaGallery,
    buyCreditsConfirmation
) {
    'use strict';

    return Component.extend({
        defaults: {
            template: 'Magento_AdobeStockImageAdminUi/grid/column/preview/actions',
            loginProvider: 'name = adobe-login, ns = adobe-login',
            mediaGallerySelector: '.media-gallery-modal:has(#search_adobe_stock)',
            adobeStockModalSelector: '.adobe-search-images-modal',
            downloadImagePreviewUrl: 'adobe_stock/preview/download',
            licenseAndDownloadUrl: 'adobe_stock/license/license',
            saveLicensedAndDownloadUrl: 'adobe_stock/license/saveLicensed',
            buyCreditsUrl: 'https://stock.adobe.com/',
            messageDelay: 5,
            imageItems: [],
            messages: [],
            listens: {
                '${ $.provider }:data.items': 'updateActions'
            },
            modules: {
                login: '${ $.loginProvider }',
                preview: '${ $.parentName }.preview',
                overlay: '${ $.parentName }.overlay',
                source: '${ $.provider }',
                imageDirectory: '${ $.mediaGalleryName }',
                mediaGallerySortBy: '${ $.mediaGallerySortBy }',
                mediaGallerySearchInput: '${ $.mediaGallerySearchInput }',
                mediaGalleryListingFilters: '${ $.mediaGalleryListingFilters }',
                listingPaging: '${ $.listingPaging }'
            },
            imports: {
                imageItems: '${ $.mediaGalleryProvider }:data.items'
            }
        },

        /**
         * Init observable variables
         *
         * @return {Object}
         */
        initObservable: function () {
            this._super()
                .observe([
                    'imageItems',
                    'messages'
                ]);

            return this;
        },

        /**
         * Update displayed record data on data source update
         */
        updateActions: function () {
            var displayedRecord = this.preview().displayedRecord(),
                updatedDisplayedRecord = this.preview().displayedRecord(),
                records = this.source().data.items,
                index;

            if (typeof displayedRecord.id === 'undefined') {
                return;
            }

            for (index = 0; index < records.length; index++) {
                if (records[index].id === displayedRecord.id) {
                    updatedDisplayedRecord = records[index];
                    break;
                }
            }

            this.preview().displayedRecord(updatedDisplayedRecord);
        },

        /**
         * Returns is_downloaded flag as observable for given record
         *
         * @returns {observable}
         */
        isDownloaded: function () {
            return this.preview().displayedRecord()['is_downloaded'];
        },

        /**
         * Is asset licensed in adobe stock in context of currently logged in account
         *
         * @returns {observable}
         */
        isLicensed: function () {
            return this.overlay().licensed()[this.preview().displayedRecord().id] && !this.isLicensedLocally();
        },

        /**
         * Is licensed version of asset saved locally
         *
         * @returns {observable}
         */
        isLicensedLocally: function () {
            return this.preview().displayedRecord()['is_licensed_locally'];
        },

        /**
         * Locate downloaded image in media browser
         */
        openInMediaGalleryClick: function () {
            this.preview().getAdobeModal().trigger('closeModal');

            if (!this.isMediaBrowser()) {
                this.selectImageInNewMediaGalleryBySearch(this.preview().displayedRecord().title);
            } else {
                this.selectDisplayedImageForOldMediaGallery(this.preview().displayedRecord().path);
            }
        },

        /**
         * Select image in new media gallery via search input
         *
         * @param {String} title
         */
        selectImageInNewMediaGalleryBySearch: function (title) {
            this.mediaGalleryListingFilters().clear();
            this.mediaGallerySearchInput().apply(title);
        },

        /**
         * Selects displayed image in media gallery
         *
         * @param {String} path
         * @param {Boolean|Undefined} openNewest
         */
        selectInMediaGallery: function (path, openNewest) {
            if (!this.isMediaBrowser()) {
                !openNewest || this.openNewestImage();
                this.selectDisplayedImageForNewMediaGallery(path);
            } else {
                this.selectDisplayedImageForOldMediaGallery(path);
            }
        },

        /**
         * Open recently saved image and go to first page
         */
        openNewestImage: function () {
            this.listingPaging().goFirst();
            this.mediaGallerySortBy().selectDefaultOption();
        },

        /**
         * Selects displayed image in media gallery for old gallery
         */
        selectDisplayedImageForOldMediaGallery: function (path) {
            var image = mediaGallery.locate(path);

            image ? image.click() : mediaGallery.notLocated();
        },

        /**
         * Selects displayed image in media gallery for new gallery
         */
        selectDisplayedImageForNewMediaGallery: function (path) {
            var imageFolders = path.substring(0, path.lastIndexOf('/')),
                record = this.getRecordFromMediaGalleryProvider(path),
                subscription; // eslint-disable-line no-unused-vars

            if (!record) {
                subscription = this.imageItems.subscribe(function () {
                    subscription.dispose();
                    record = this.getRecordFromMediaGalleryProvider(path);

                    if (!record) {
                        mediaGallery.notLocated();
                    }

                    this.selectRecord(record);
                }.bind(this));
            }

            if (imageFolders) {
                this.imageDirectory().selectFolder(imageFolders);
            } else {
                this.imageDirectory().selectStorageRoot();
            }

            if (record) {
                this.selectRecord(record);
            }
        },

        /**
         * Get image data by image file name
         *
         * @param {String} path
         * @returns {null|Object}
         */
        getRecordFromMediaGalleryProvider: function (path) {
            var report = null;

            this.imageItems.each(function (item) {
                if (item.path === path) {
                    report = item;

                    return false;
                }
            });

            return report;
        },

        /**
         * Set the record as selected
         *
         * @param {Object} record
         */
        selectRecord: function (record) {
            uiRegistry.get('name =' + this.mediaGallery).selected(record);
        },

        /**
         * Save preview click handler
         */
        savePreviewClick: function () {
            var record = this.preview().displayedRecord();

            savePreviewAction(
                this.preview().downloadImagePreviewUrl,
                record.id,
                record.title,
                record['content_type'],
                this.getDestinationDirectoryPath()
            ).then(function (destinationPath) {
                this.updateDownloadedDisplayedRecord(destinationPath);
                this.updateGridsAndSelectSavedAsset(destinationPath);
            }.bind(this)).fail(function (error) {
                if (error) {
                    this.showErrorMessage(error);
                }
            }.bind(this));
        },

        /**
         * Update displayed record after downloading
         *
         * @param {String} path
         */
        updateDownloadedDisplayedRecord: function (path) {
            var record = this.preview().displayedRecord();

            record['is_downloaded'] = 1;

            if (record.path === '') {
                record.path = path;
            }

            this.preview().displayedRecord(record);
        },

        /**
         * Update displayed record after licensing
         *
         * @param {String} path
         */
        updateLicensedDisplayedRecord: function (path) {
            var record = this.preview().displayedRecord();

            record['is_downloaded'] = 1;

            if (record.path === '') {
                record.path = path;
            }

            record['is_licensed'] = 1;
            record['is_licensed_locally'] = 1;

            this.preview().displayedRecord(record);
        },

        /**
         * Update view
         */
        updateGridsAndSelectSavedAsset: function (path) {
            this.source().reload({
                refresh: true
            });
            this.preview().getAdobeModal().trigger('closeModal');
            $.ajaxSetup({
                async: false
            });
            this.reloadGrid();
            $.ajaxSetup({
                async: true
            });
            this.selectInMediaGallery(path, true);
        },

        /**
         * Get image destination path
         *
         * @param {String} fileName
         * @param {String} contentType
         * @returns {String}
         */
        getDestinationPath: function (fileName, contentType) {
            return this.getDestinationDirectoryPath() + '/' + fileName + '.' + this.getImageExtension(contentType);
        },

        /**
         * Get destination directory path
         *
         * @returns {String}
         */
        getDestinationDirectoryPath: function () {
            var activeNodePath,
                activeNode;

            if (this.isMediaBrowser()) {
                activeNode = this.getMageMediaBrowserData().activeNode;

                activeNodePath = _.isUndefined(activeNode.path) ? '' : activeNode.path;
            } else {
                activeNodePath = this.imageDirectory().activeNode() || '';
            }

            return activeNodePath;
        },

        /**
         * Reload grid
         *
         * @returns {*}
         */
        reloadGrid: function () {
            var provider,
                dataStorage;

            if (this.isMediaBrowser()) {
                return this.getMageMediaBrowserData().reload();
            }

            provider = uiRegistry.get('index = media_gallery_listing_data_source'),
            dataStorage = provider.storage();

            // this.subscriptionOnImageItems();
            dataStorage.clearRequests();
            provider.reload();
        },

        /**
         * Get data for media browser
         *
         * @returns {Undefined|Object}
         */
        getMageMediaBrowserData: function () {
            return $(this.preview().mediaGallerySelector).data('mageMediabrowser');
        },

        /**
         * Is the media browser used in the content of the grid
         *
         * @returns {Boolean}
         */
        isMediaBrowser: function () {
            return typeof this.getMageMediaBrowserData() !== 'undefined';
        },

        /**
         * Generate meaningful name image file,
         * allow only alphanumerics, dashes, and underscores
         *
         * @param {String} title
         * @param {Number} id
         * @return string
         */
        generateImageName: function (title, id) {
            var fileName = title.substring(0, 32)
                .replace(/[^a-zA-Z0-9_]/g, '-')
                .replace(/-{2,}/g, '-')
                .toLowerCase();

            /* If the filename does not contain latin chars, use ID as a filename */
            return fileName === '-' ? id : fileName;
        },

        /**
         * Get image file extension
         *
         * @param {String} contentType
         * @return string
         */
        getImageExtension: function (contentType) {
            return contentType.match(/[^/]{1,4}$/);
        },

        /**
         * Get messages
         *
         * @return {Array}
         */
        getMessages: function () {
            return this.messages();
        },

        /**
         * License click handler
         */
        licenseClick: function () {
            var record = this.preview().displayedRecord();

            this.licenseProcess(
                record.id,
                record.title,
                record.path,
                record['content_type'],
                this.isLicensed(),
                this.isDownloaded()
            ).then(function (destinationPath) {
                this.updateLicensedDisplayedRecord(destinationPath);
                this.login().getUserQuota();
                this.updateGridsAndSelectSavedAsset(destinationPath);
            }.bind(this)).fail(function (error) {
                if (error) {
                    this.showErrorMessage(error);
                }
            }.bind(this));
        },

        /**
         * Process of license
         *
         * @param {Number} id
         * @param {String} title
         * @param {String} path
         * @param {String} contentType
         * @param {Boolean} isLicensed
         * @param {Boolean} isDownloaded
         * @return {window.Promise}
         */
        licenseProcess: function (id, title, path, contentType, isLicensed, isDownloaded) {
            var deferred = $.Deferred();

            $.ajaxSetup({
                async: false
            });
            this.login().login()
                .then(function () {
                    if (isLicensed) {
                        saveLicensedAction(
                            this.preview().saveLicensedAndDownloadUrl,
                            id,
                            title,
                            path,
                            contentType,
                            this.getDestinationDirectoryPath()
                        ).then(function (destinationPath) {
                            deferred.resolve(destinationPath);
                        }).fail(function (error) {
                            deferred.reject(error);
                        });
                    } else {
                        confirmQuotaAction(this.preview().confirmationUrl, id).then(function (data) {
                            if (data.canLicense === false) {
                                buyCreditsConfirmation(
                                    this.preview().buyCreditsUrl,
                                    title,
                                    data.message
                                );

                                return;
                            }
                            licenseAndSaveAction(
                                this.preview().licenseAndDownloadUrl,
                                id,
                                title,
                                path,
                                contentType,
                                isDownloaded,
                                data.message,
                                this.getDestinationDirectoryPath()
                            ).then(function (destinationPath) {
                                deferred.resolve(destinationPath);
                            }).fail(function (error) {
                                deferred.reject(error);
                            });
                        }.bind(this));
                    }
                    $.ajaxSetup({
                        async: true
                    });
                }.bind(this))
                .fail(function (error) {
                    deferred.reject(error);
                });

            return deferred.promise();
        },

        /**
         * Save licensed click handler
         */
        saveLicensedClick: function () {
            var record = this.preview().displayedRecord();

            if (!this.login().user().isAuthorized) {
                return;
            }

            if (!this.isLicensed()) {
                return;
            }

            saveLicensedAction(
                this.preview().saveLicensedAndDownloadUrl,
                record.id,
                record.title,
                record.path,
                record['content_type'],
                this.getDestinationDirectoryPath()
            ).then(function (destinationPath) {
                this.updateLicensedDisplayedRecord(destinationPath);
                this.login().getUserQuota();
                this.updateGridsAndSelectSavedAsset(destinationPath);
            }.bind(this)).fail(function (error) {
                if (error) {
                    this.showErrorMessage(error);
                }
            }.bind(this));
        },

        /**
         * Returns license button title depending on the existing saved preview
         *
         * @returns {String}
         */
        getLicenseButtonTitle: function () {
            return this.isDownloaded() ?  $.mage.__('License') : $.mage.__('License and Save');
        },

        /**
         * Extracts image name from its path
         *
         * @param {String} path
         * @returns {String}
         */
        getImageNameFromPath: function (path) {
            var filePathArray = path.split('/'),
                imageIndex = filePathArray.length - 1;

            return filePathArray[imageIndex].substring(0, filePathArray[imageIndex].lastIndexOf('.'));
        },

        /**
         * Show error message and schedule cleanup
         *
         * @param {String} message
         */
        showErrorMessage: function (message) {
            this.messages.push({
                code: 'error',
                messageUnsanitizedHtml: message
            });
            this.messagesCleanup();
        },

        /**
         * Messages cleanup
         */
        messagesCleanup: function () {
            // eslint-disable-next-line no-unused-vars
            var timerId;

            timerId = setTimeout(function () {
                clearTimeout(timerId);
                this.messages.removeAll();
            }.bind(this), Number(this.messageDelay) * 1000);
        }
    });
});
