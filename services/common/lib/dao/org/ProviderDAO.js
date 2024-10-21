var _ = require('lodash');
var moment = require('moment');
var orgModels = require('../../model/OrgModels.js');

// Returns ALL active and inactive providers of all specialties.
function getProviders(orgInternalName) {
	if (!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');

	return orgModels.getModelsForOrg(orgInternalName)
		.then(function (models) {
			return models.Provider.findAll();
		})
		.then(function (providerEntities) {
			return Promise.resolve(_.map(providerEntities,function(providerEntity) { return providerEntity.toJSON(); }));
		});
}

// Returns ALL active and inactive providers of all specialties.
function getProvidersByFacility(orgInternalName, facilityId) {
	if (!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');

	if(facilityId == null)
		throw new Error('Missing parameter facilityId.');

	return orgModels.getModelsForOrg(orgInternalName)
		.then(function (models) {
			return models.Provider.findAll({
				where: {
					facilityId: facilityId
				}
			});
		})
		.then(function (providerEntities) {
			return Promise.resolve(_.map(providerEntities,function(providerEntity) { return providerEntity.toJSON(); }));
		});
}

function getProvidersWhoSubmittedQcdrData(orgInternalName, startDate, endDate) {

	if(!orgInternalName)
		throw new Error('Missing parameter orgInternalName.');
	if(!startDate)
		throw new Error('Missing parameter startDate.');
	if(!endDate)
		throw new Error('Missing parameter endDate.');

	var query = `WITH cases AS (
		SELECT f.org_id,
			   f.fac_id,
			   e.enctr_id,
			   efs.enctr_form_id,
			   efs.proc_dt
		  FROM fac f
		  JOIN enctr e
			ON e.fac_id = f.fac_id
		   AND e.purged_ind IS DISTINCT FROM TRUE   -- exclude purged encounters
		  JOIN enctr_form ef
			ON ef.enctr_id = e.enctr_id
		   AND ef.void_ind IS DISTINCT FROM TRUE    -- exclude voided forms
		  JOIN form_defn fd
			ON fd.form_defn_id = ef.form_defn_id
		   AND CAST(fd.prop_map->'formIsAnesCaseInd' AS BOOLEAN) IS NOT DISTINCT FROM TRUE  -- exclude NULL or FALSE (i.e. forms not explicitly tagged as "anesthesia cases")
		  JOIN enctr_form_surgery efs
			ON efs.enctr_form_id = ef.enctr_form_id
		 WHERE efs.proc_dt BETWEEN :startDate AND :endDate
		   AND efs.qcdr_eval_result IS NOT NULL
	 ),
	 anes_prvrs AS (
		SELECT org_id,
			   fac_id,
			   enctr_form_id,
			   anes_prvr_id,
			   last_nm,
			   frst_nm,
			   prvr_typ,
			   natl_prvr_id
		  FROM (SELECT DISTINCT
					   org_id,
					   anes_dtl.fac_id,
					   enctr_form_id,
					   anes_prvr_seq,
					   anes_prvr_id,
					   COALESCE(p.frst_nm,'UNKNOWN') AS frst_nm,
					   COALESCE(p.last_nm,'UNKNOWN') AS last_nm,
					   prvr_typ,
					   COALESCE(p.natl_prvr_id,'UNKNOWN') AS natl_prvr_id
				  FROM (SELECT cases.org_id,
							   cases.fac_id,
							   cases.enctr_form_id,
							   cases.enctr_id,
							   ps.page_id,
							   ps.page_nm,
							   ps.page_no,
							   psd.prop_seq AS anes_prvr_seq,
							   MAX(CASE WHEN psd.prop_nm::text = 'anes_prvr_id'::text THEN psd.prop_val::BIGINT ELSE NULL::BIGINT END) AS anes_prvr_id
						  FROM cases
						  JOIN page_surgery ps
							ON ps.enctr_form_id = cases.enctr_form_id
						  JOIN page_surgery_dtl psd
							ON psd.page_id = ps.page_id
						 WHERE ((psd.prop_nm)::text = ANY ('{anes_prvr_id}'::text[]))
						 GROUP BY cases.org_id,
								  cases.fac_id,
								  cases.enctr_form_id,
								  cases.enctr_id,
								  ps.page_id,
								  ps.page_nm,
								  ps.page_no,
								  psd.prop_seq) anes_dtl
				  JOIN prvr p
					ON p.prvr_id = anes_dtl.anes_prvr_id
				 WHERE anes_dtl.anes_prvr_id IS NOT NULL) prvrs
	 )
	 SELECT cases.fac_id as "facilityId",
			anes_prvr_id as "providerId",
			natl_prvr_id as "nationalProviderId",
			frst_nm as "firstName",
			last_nm as "lastName",
			prvr_typ as "providerType",
			COUNT(DISTINCT cases.enctr_form_id) AS "caseCount"
	   FROM cases
	   JOIN anes_prvrs
		 ON anes_prvrs.org_id = cases.org_id
		AND anes_prvrs.fac_id = cases.fac_id
		AND anes_prvrs.enctr_form_id = cases.enctr_form_id
	  GROUP BY 1,2,3,4,5,6`;

	var queryOptions = {
		type: "SELECT",
		replacements: {
		  startDate: startDate,
		  endDate: endDate
		}
	};

	return orgModels.query(orgInternalName, query, queryOptions)
		.then(function(results) {
			return results;
		});
}


module.exports = {
	getProviders: getProviders,
	getProvidersByFacility: getProvidersByFacility,
	getProvidersWhoSubmittedQcdrData: getProvidersWhoSubmittedQcdrData
}