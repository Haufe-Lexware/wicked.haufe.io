# Approver role for User Groups 

## Introduction 
The group feature now supports an approval role.  The approver role allows for controlling which users have the ability to approve API subscription requests.  
 
Approver role provides flexibility for use of the Wicked API portal across an enterprise, where there may be business or commercial need to segment who has the responsibility to take action on an API approval request. By introducing the approver group type, we are able to control who sees what API approval requests.  

## How it works 

### Configuring Groups to have approval role

The Groups Configuration Screen in Kickstarter has a checkbox which allows the user to assign a new group type called 'approver' as part of Group Definition. For example, we create a new group called 'Electric Car API Approver' and assign it as approver 
 _Note: **This change does not impact existing admin group functionality**._ 
 
![approver1](https://user-images.githubusercontent.com/9421117/36286403-74ae8e34-1264-11e8-9c65-1432bef850ee.png)

### Associating APIs to approvers 

The Alternative IDs field of the approver group must contain the Group IDs associated with the APIs, enabling the approver to see their approval requests when logging into the Wicked API Portal. For example, our gateway has an API, 'Charge Reader'.  To allow members of the 'Electric Car API Approver' group to see approval requests for this API in the portal, the Group IDs for API 'Charge Reader' is added to the approver group.  
 
![approver2](https://user-images.githubusercontent.com/9421117/36286407-7bc71e66-1264-11e8-95dc-967ef6d47381.png)

### API Portal UI 

The API portal menu for an approver includes a link to 'Pending Approvals' 
![approver3](https://user-images.githubusercontent.com/9421117/36286412-8387c5f6-1264-11e8-83e8-45216cf0fa34.png)
