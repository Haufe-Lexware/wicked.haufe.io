# LDAP Authentication

The wicked Authorization Server can query an LDAP server in order to authenticate users. For certain situations, this can be a very convenient way of getting enterprise identities into your API setup. **Note**: Often, the LDAP server is not available from outside of the company network, so be sure you know the ins and outs of your enterprise network architecture before planning on using the LDAP auth method in situations outside of your company network.

## How this works

The LDAP authentication works very similar to how the [`external` auth method](auth-external.md) works. Wicked will display a generic log in mask, asking for a username and password, which it will then go search for in the LDAP database, and try to verify the username and password against the LDAP.

More technically, a log in process works like this:

1. The username is checked for invalid characters (wild cards and such) 
1. The authorization server binds to the LDAP server, using the given LDAP username and password
1. The AS performs a `search` query with the given base DN (base distinguished name) and the given filter, where the part `%username%` is replaced with the given username
1. In case just a single LDAP entry is returned, the distinguished name of this entry (the `DN`) is extracted
1. The `DN` and the provided password is used to `bind` to the LDAP server; if this is successful, the user has been successfully authenticated
1. The information from the LDAP entry is used to create a profile, which is then used in wicked for further processing

## Configuration

You will need the following information:

* LDAP URL, e.g. `ldaps://ldap.company.com:636`
* User and password for the LDAP, being allowed to run a `search` query
* Which LDAP attribute is being used to log in (see below)
* The Base DN under which to search; typically something like `DC=domain,DC=company,DC=com`

### Configuration for Microsoft AD

Microsoft Active Directory's LDAP server typically stores the log in name in the `sAMAccountName` attribute, so this is the way you would configure LDAP access for a typical AD server:

* Filter: `(&(objectClass=organizationalPerson)(sAMAccountName=%username%))`
* Profile:
```
{
    "sub": "sAMAccountName",
    "email": "mail",
    "name": "displayName"
}
```

If you want to map other things, or map things differently, it is recommended to use a tool such as [Apache Directory Studio](https://directory.apache.org/studio/) to find out the additional mappings. Most important here is the `sub` and `email` mappings - both are mandatory. The `sub` mapping must be something which is 100% unique inside the organization. Typically, this can be the account name, but you may also want to point this to something else, e.g. some company internal special ID or similar.
